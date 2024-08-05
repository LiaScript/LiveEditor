<script lang="ts">
import { ref, computed, onUnmounted, defineComponent } from "vue";
import { getAllSupportedVideoCodecs } from "../ts/utils.ts";

interface Props {
  storeBlob: (blob: Blob) => void;
}

export default defineComponent({
  name: "Recorder",

  props: {
    storeBlob: {
      type: Function as () => Props["storeBlob"],
      required: true,
    },

    stream: {
      type: String as () => "webcam" | "desktop",
      default: "webcam",
      validator: (value: string) => ["webcam", "desktop"].includes(value),
    },
  },

  setup(props) {
    const liveVideoElement = ref(null);
    const playbackVideoElement = ref(null);
    const mediaRecorder = ref(null);
    const recordedChunks = ref([]);
    const isRecording = ref(false);
    const isDownloading = ref(false);
    const isPaused = ref(false);
    const selectedQuality = ref("low");
    const compressionProgress = ref(0);
    let stream = null;

    const hasRecording = computed(() => recordedChunks.value.length > 0);

    const getMediaConstraints = (quality) => {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 48000 },
          channelCount: { ideal: 2 },
          bitrate: { ideal: 128000 },
        },
      };

      switch (quality) {
        case "ultra-low":
          constraints.video.width.ideal = 320;
          constraints.video.height.ideal = 240;
          constraints.video.frameRate.ideal = 5;
          constraints.audio.sampleRate.ideal = 16000;
          constraints.audio.channelCount.ideal = 1;
          constraints.audio.bitrate.ideal = 32000;
          break;
        case "low":
          constraints.video.width.ideal = 640;
          constraints.video.height.ideal = 480;
          constraints.video.frameRate.ideal = 15;
          constraints.audio.sampleRate.ideal = 22050;
          constraints.audio.channelCount.ideal = 1;
          constraints.audio.bitrate.ideal = 64000;
          break;
        case "medium":
          constraints.video.width.ideal = 1280;
          constraints.video.height.ideal = 720;
          constraints.video.frameRate.ideal = 30;
          constraints.audio.sampleRate.ideal = 44100;
          constraints.audio.channelCount.ideal = 2;
          constraints.audio.bitrate.ideal = 96000;
          break;
        case "high":
          constraints.video.width.ideal = 1920;
          constraints.video.height.ideal = 1080;
          constraints.video.frameRate.ideal = 30;
          constraints.audio.sampleRate.ideal = 48000;
          constraints.audio.channelCount.ideal = 2;
          constraints.audio.bitrate.ideal = 128000;
          break;
      }

      console.log(constraints);
      return constraints;
    };

    const startRecording = async () => {
      deleteRecording();

      try {
        const constraints = getMediaConstraints(selectedQuality.value);
        if (props.stream === "webcam") {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else if (props.stream === "desktop") {
          stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        }
        liveVideoElement.value.srcObject = stream;
        mediaRecorder.value = new MediaRecorder(stream);

        mediaRecorder.value.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunks.value.push(event.data);
          }
        };

        mediaRecorder.value.onstop = () => {
          const blob = new Blob(recordedChunks.value, { type: "video/webm" });
          playbackVideoElement.value.src = URL.createObjectURL(blob);
        };

        mediaRecorder.value.start();
        isRecording.value = true;
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    const stopRecording = () => {
      mediaRecorder.value.stop();
      stream.getTracks().forEach((track) => track.stop());
      isRecording.value = false;
      isPaused.value = false;
    };

    const togglePause = () => {
      if (isPaused.value) {
        mediaRecorder.value.resume();
      } else {
        mediaRecorder.value.pause();
      }
      isPaused.value = !isPaused.value;
    };

    const toggleRecording = () => {
      if (isRecording.value) {
        stopRecording();
      } else {
        startRecording();
      }
    };

    const deleteRecording = () => {
      recordedChunks.value = [];
      if (playbackVideoElement.value) {
        playbackVideoElement.value.pause();
        playbackVideoElement.value.src = "";
      }
    };

    const compressVideo = async (blob, quality) => {
      const supportedCodecs = await getAllSupportedVideoCodecs();
      let mimeType = "video/webm";
      const codecPreferences = {
        high: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
        medium: ["video/webm;codecs=vp8,opus", "video/webm"],
        low: ["video/webm;codecs=vp8,opus", "video/webm"],
        "ultra-low": ["video/webm;codecs=vp8,opus", "video/webm"],
      };
      const preferredCodecs = codecPreferences[quality];
      for (const codec of preferredCodecs) {
        if (supportedCodecs.includes(codec)) {
          mimeType = codec;
          break;
        }
      }

      const originalVideo = document.createElement("video");
      originalVideo.src = URL.createObjectURL(blob);
      await new Promise((resolve) => (originalVideo.onloadedmetadata = resolve));

      const qualitySettings = {
        "ultra-low": { videoBitsPerSecond: 100000, audioBitsPerSecond: 32000 },
        low: { videoBitsPerSecond: 300000, audioBitsPerSecond: 64000 },
        medium: { videoBitsPerSecond: 1000000, audioBitsPerSecond: 96000 },
        high: { videoBitsPerSecond: 2500000, audioBitsPerSecond: 128000 },
      };
      const settings = qualitySettings[quality] || qualitySettings["medium"];

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = originalVideo.videoWidth;
      canvas.height = originalVideo.videoHeight;

      const stream = canvas.captureStream();

      // Add audio track
      let audioTrack;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrack = audioStream.getAudioTracks()[0];
        stream.addTrack(audioTrack);
      } catch (error) {
        console.warn("Unable to capture audio. Compressing without audio.", error);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: settings.videoBitsPerSecond,
        audioBitsPerSecond: settings.audioBitsPerSecond,
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.start(100); // Start recording in 100ms chunks

      originalVideo.currentTime = 0;
      await new Promise((resolve) => (originalVideo.oncanplay = resolve));
      originalVideo.play();

      compressionProgress.value = 0;
      const updateInterval = 500; // Update progress every 500ms
      let lastUpdateTime = 0;

      const processFrame = async () => {
        if (originalVideo.paused || originalVideo.ended) {
          mediaRecorder.stop();
          if (audioTrack) audioTrack.stop();
          return;
        }

        ctx.drawImage(originalVideo, 0, 0, canvas.width, canvas.height);

        const currentTime = Date.now();
        if (currentTime - lastUpdateTime >= updateInterval) {
          compressionProgress.value = Math.round(
            (originalVideo.currentTime / originalVideo.duration) * 100
          );
          lastUpdateTime = currentTime;
        }

        requestAnimationFrame(processFrame);
      };

      processFrame();

      return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: mimeType });
          resolve(compressedBlob);
        };

        originalVideo.onended = () => {
          mediaRecorder.stop();
          if (audioTrack) audioTrack.stop();
        };
      });
    };

    const downloadRecording = async () => {
      isDownloading.value = true;

      const blob = new Blob(recordedChunks.value, { type: "video/webm" });

      const quality = selectedQuality.value;

      let downloadBlob;
      if (quality === "high") {
        // For high quality, use the original blob without compression
        downloadBlob = blob;
      } else {
        // For other qualities, compress the video before downloading
        downloadBlob = await compressVideo(blob, quality);
      }

      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.style = "display: none";
      a.href = url;
      a.download =
        quality === "high" ? "recording-original.webm" : "recording-compressed.webm";
      a.click();
      window.URL.revokeObjectURL(url);

      isDownloading.value = false;
    };

    const downloadBlob = async () => {
      isDownloading.value = true;

      const blob = new Blob(recordedChunks.value, { type: "video/webm" });
      const targetSize = 5000000; // Example target size in bytes
      const quality = selectedQuality.value; // Choose between "ultra-low", "low", "medium", "high"

      let downloadBlob;
      if (quality === "high") {
        // For high quality, use the original blob without compression
        downloadBlob = blob;
      } else {
        // For other qualities, compress the video before downloading
        downloadBlob = await compressVideo(blob, quality);
      }

      props.storeBlob(downloadBlob);

      isDownloading.value = false;
    };

    onUnmounted(() => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    });

    return {
      liveVideoElement,
      playbackVideoElement,
      isRecording,
      isDownloading,
      isPaused,
      hasRecording,
      selectedQuality,
      compressionProgress,
      startRecording,
      stopRecording,
      togglePause,
      toggleRecording,
      deleteRecording,
      downloadRecording,
      downloadBlob,
      storeBlob: props.storeBlob,
      stream: props.stream,
    };
  },
});
</script>

<template>
  <div class="widget">
    <div class="webcam-recorder">
      <div class="video-container">
        <video ref="liveVideoElement" width="640" height="480" autoplay muted></video>
        <video
          ref="playbackVideoElement"
          width="640"
          height="480"
          controls
          :style="{ display: hasRecording ? 'block' : 'none' }"
        ></video>
        <div
          style="
            z-index: 1000;
            position: inherit;
            font-size: xx-large;
            background-color: rgba(0, 0, 0, 0.8);
            padding: 10px;
            color: white;
            max-width: 100%;
          "
          v-if="isDownloading"
        >
          Video compression is running please wait... {{ compressionProgress }}%
        </div>
      </div>

      <div class="controls">
        <select v-model="selectedQuality" :disabled="isRecording || isDownloading">
          <option value="high">High Quality</option>
          <option value="medium">Medium Quality</option>
          <option value="low">Low Quality</option>
          <option value="ultra-low">Ultra-Low Quality</option>
        </select>
        <button @click="toggleRecording" :disabled="isDownloading">
          {{ isRecording ? "Stop" : "Start" }}
        </button>
        <button @click="togglePause" :disabled="!isRecording || isDownloading">
          {{ isPaused ? "Resume" : "Pause" }}
        </button>
        <button @click="deleteRecording" :disabled="!hasRecording || isDownloading">
          Delete
        </button>
        <button @click="downloadRecording" :disabled="!hasRecording || isDownloading">
          Download
        </button>
        <button @click="downloadBlob" :disabled="!hasRecording || isDownloading">
          Insert
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget {
  margin: 5px;
  padding: 30px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.webcam-recorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 640px;
  margin: 0 auto;
}

.video-container {
  position: relative;
  width: 640px;
  height: 480px;
  border: 2px solid #333;
  overflow: hidden;
}

video {
  position: absolute;
  top: 0;
  left: 0;
}

.controls {
  margin-top: 10px;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}

select {
  margin: 5px;
  padding: 8px;
  font-size: 14px;
}

button {
  margin: 5px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
