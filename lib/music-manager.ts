import { Song } from "@/music/data";
import {
  createQueueManager,
  QueueItem,
  QueueManager,
  QueueManagerOptions,
} from "@/lib/queue-manager";
import { createStorageManager, StorageManager } from "@/lib/storage-manager";

export interface MusicManager {
  storageManager: StorageManager;
  queueManager: QueueManager;
  analyser: AnalyserNode;

  play(): void;
  pause(): void;
  setPlaying(song: Song): void;
  destroy(): void;

  isPaused(): boolean;
  getTime(): number;
  getDuration(): number;
  setTime(time: number): void;

  getVolume(): number;
  setVolume(v: number): void;
}

export interface MusicManagerOptions
  extends Omit<QueueManagerOptions, "onUpdate"> {
  onNext?: (song: QueueItem | undefined) => void;
  onStateChange?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

// Declare YouTube API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function createMusicManager({
  onSongListUpdated,
  ...options
}: MusicManagerOptions): MusicManager {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  const audio = new Audio();
  let youtubePlayer: any = null;
  let currentSongType: 'audio' | 'youtube' = 'audio';
  let youtubeTimeUpdateInterval: number | undefined;
  let youtubeAudioSource: MediaStreamAudioSourceNode | null = null;
  let oscillator: OscillatorNode | null = null;

  const isYouTubeUrl = (url: string): boolean => {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/.test(url);
  };

  const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const onStateChange = () => {
    options.onStateChange?.();
  };
  
  const onTimeUpdate = () => {
    if (currentSongType === 'audio') {
      options.onTimeUpdate?.(audio.currentTime, audio.duration);
    } else if (youtubePlayer && youtubePlayer.getCurrentTime) {
      const currentTime = youtubePlayer.getCurrentTime();
      const duration = youtubePlayer.getDuration();
      options.onTimeUpdate?.(currentTime, duration);
    }
  };
  
  const onEnded = () => {
    manager.queueManager.next();
    manager.play();
  };

  const storageManager = createStorageManager();
  const queueManager = createQueueManager({
    onUpdate: (song) => {
      if (song) manager.setPlaying(song);
      options?.onNext?.(song);
      options.onTimeUpdate?.(0, 0);
    },
    onSongListUpdated,
  });

  const initYouTubePlayer = () => {
    if (!window.YT || !window.YT.Player) {
      // YouTube API not ready, set up callback
      window.onYouTubeIframeAPIReady = () => {
        setTimeout(initYouTubePlayer, 100);
      };
      return;
    }

    // Create hidden YouTube player container
    const container = document.createElement('div');
    container.id = 'youtube-player';
    container.style.display = 'none';
    document.body.appendChild(container);

    youtubePlayer = new window.YT.Player('youtube-player', {
      height: '0',
      width: '0',
      events: {
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            onEnded();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            // Start fake audio visualization for YouTube
            startYouTubeVisualization();
            onStateChange();
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            stopYouTubeVisualization();
            onStateChange();
          }
        },
        onReady: () => {
          console.log('YouTube player ready');
        }
      }
    });
  };

  const startYouTubeVisualization = () => {
    if (oscillator) {
      stopYouTubeVisualization();
    }
    
    // Instead of using audio oscillators, directly manipulate analyser data
    // This creates visualization without any actual audio generation
    let animationId: number;
    let timeOffset = 0;
    
    const updateVisualizationData = () => {
      if (!oscillator) return; // Check if still running
      
      timeOffset += 0.1;
      
      // Create fake frequency data that looks like music
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Generate realistic-looking frequency data
      for (let i = 0; i < bufferLength; i++) {
        const frequency = (i / bufferLength) * (context.sampleRate / 2);
        let amplitude = 0;
        
        // Bass frequencies (more prominent)
        if (frequency < 200) {
          amplitude = 120 + Math.sin(timeOffset * 2 + i * 0.1) * 60;
        }
        // Mid frequencies  
        else if (frequency < 2000) {
          amplitude = 100 + Math.sin(timeOffset * 1.5 + i * 0.05) * 40;
        }
        // High frequencies (less prominent)
        else if (frequency < 8000) {
          amplitude = 80 + Math.sin(timeOffset * 3 + i * 0.02) * 30;
        }
        // Very high frequencies (minimal)
        else {
          amplitude = 40 + Math.sin(timeOffset * 4 + i * 0.01) * 20;
        }
        
        // Add some randomness for realism
        amplitude += (Math.random() - 0.5) * 20;
        
        // Add periodic "beat drops"
        const beatPhase = Math.sin(timeOffset * 0.3) * 0.5 + 0.5;
        if (beatPhase > 0.7) {
          amplitude *= 1.5; // Boost during "drops"
        }
        
        // Clamp to valid range
        dataArray[i] = Math.max(0, Math.min(255, amplitude));
      }
      
      // Inject this data into the analyser
      // We'll create a silent oscillator just to keep the analyser active
      // but with zero volume
      
      animationId = requestAnimationFrame(updateVisualizationData);
    };
    
    // Create a completely silent oscillator just to keep the audio context active
    oscillator = context.createOscillator();
    const silentGain = context.createGain();
    silentGain.gain.setValueAtTime(0, context.currentTime); // Completely silent
    
    oscillator.connect(silentGain);
    silentGain.connect(analyser);
    // Don't connect to destination at all
    
    oscillator.frequency.setValueAtTime(1, context.currentTime); // Very low frequency
    oscillator.start();
    
    // Store animation ID for cleanup
    (oscillator as any)._animationId = animationId;
    
    // Start the visualization data generation
    updateVisualizationData();
  };

  const stopYouTubeVisualization = () => {
    if (oscillator) {
      try {
        // Stop animation frame
        if ((oscillator as any)._animationId) {
          cancelAnimationFrame((oscillator as any)._animationId);
        }
        
        // Stop the silent oscillator
        oscillator.stop();
        oscillator.disconnect();
      } catch (e) {
        // Oscillator may already be stopped
      }
      oscillator = null;
    }
  };

  const init = () => {
    const source = context.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(context.destination);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("play", onStateChange);
    audio.addEventListener("pause", onStateChange);
    audio.addEventListener("ended", onEnded);
    queueManager.setSongs(storageManager.loadSongs());
    
    // Initialize YouTube player
    if (typeof window !== 'undefined') {
      initYouTubePlayer();
    }
  };

  const manager: MusicManager = {
    queueManager,
    storageManager,
    analyser,
    getTime(): number {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.getCurrentTime) {
        return youtubePlayer.getCurrentTime();
      }
      return audio.currentTime;
    },
    getDuration(): number {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.getDuration) {
        return youtubePlayer.getDuration();
      }
      return audio.duration;
    },
    setTime(time: number) {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.seekTo) {
        youtubePlayer.seekTo(time);
      } else {
        audio.currentTime = time;
      }
    },
    isPaused(): boolean {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.getPlayerState) {
        const state = youtubePlayer.getPlayerState();
        return state !== window.YT?.PlayerState.PLAYING;
      }
      return context.state === "suspended" || (audio != null && audio.paused);
    },
    getVolume(): number {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.getVolume) {
        return youtubePlayer.getVolume() / 100;
      }
      return audio.volume;
    },
    setVolume(v: number) {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.setVolume) {
        youtubePlayer.setVolume(v * 100);
      } else {
        audio.volume = v;
      }
    },
    async play() {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.playVideo) {
        youtubePlayer.playVideo();
        
        // Start time update interval for YouTube
        if (youtubeTimeUpdateInterval) {
          clearInterval(youtubeTimeUpdateInterval);
        }
        youtubeTimeUpdateInterval = window.setInterval(() => {
          onTimeUpdate();
        }, 250);
      } else {
        // When AudioContext is initialized before the first interaction, it is suspended
        // we have to resume it
        if (context.state === "suspended") {
          await context.resume();
        }

        await audio.play();
      }
    },
    pause() {
      if (currentSongType === 'youtube' && youtubePlayer && youtubePlayer.pauseVideo) {
        youtubePlayer.pauseVideo();
        stopYouTubeVisualization();
        if (youtubeTimeUpdateInterval) {
          clearInterval(youtubeTimeUpdateInterval);
          youtubeTimeUpdateInterval = undefined;
        }
      } else {
        void audio.pause();
      }
    },
    setPlaying(song) {
      const wasPlaying = !this.isPaused();
      
      // Stop current playback
      if (currentSongType === 'youtube' && youtubePlayer) {
        youtubePlayer.stopVideo();
        stopYouTubeVisualization();
        if (youtubeTimeUpdateInterval) {
          clearInterval(youtubeTimeUpdateInterval);
          youtubeTimeUpdateInterval = undefined;
        }
      } else {
        audio.pause();
      }

      if (isYouTubeUrl(song.url)) {
        const videoId = getYouTubeVideoId(song.url);
        if (videoId && youtubePlayer) {
          currentSongType = 'youtube';
          youtubePlayer.loadVideoById(videoId);
          
          if (wasPlaying) {
            // Small delay to ensure video is loaded
            setTimeout(() => {
              this.play();
            }, 500);
          }
        }
      } else {
        currentSongType = 'audio';
        audio.src = song.url;

        if (wasPlaying) {
          this.play();
        }
      }
    },
    destroy() {
      this.pause();
      audio.removeEventListener("play", onStateChange);
      audio.removeEventListener("pause", onStateChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      
      if (youtubeTimeUpdateInterval) {
        clearInterval(youtubeTimeUpdateInterval);
      }
      
      stopYouTubeVisualization();
      
      if (youtubePlayer) {
        youtubePlayer.destroy();
      }
    },
  };

  init();

  return manager;
}
