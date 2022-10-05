<template>
  <iframe
    id="liascript-preview"
    src="./liascript/index.html?"
  ></iframe>
</template>

<script lang="ts">
export default {
  name: "Preview",

  data() {
    return {
      isReady: false,
      responsiveVoiceKey: undefined,
    };
  },

  emits: ["ready", "update"],

  methods: {
    onReady(params: any) {
      const iframe = document.getElementById(
        "liascript-preview"
      ) as HTMLIFrameElement;

      if (!this.isReady && iframe && iframe.contentWindow) {
        this.isReady = true;

        // only inject if key has been defined
        if (this.responsiveVoiceKey) {
          iframe.contentWindow.LIA.injectResposivevoice(
            this.responsiveVoiceKey
          );
        }

        this.$emit("ready", iframe.contentWindow.LIA);
      }

      if (params) {
        this.$emit("update", params);
      }
    },
  },

  mounted() {
    const iframe = document.getElementById("liascript-preview");

    if (iframe && iframe.contentWindow) {
      if (!iframe.contentWindow.LIA) {
        iframe.contentWindow.LIA = {};
      }

      iframe.contentWindow.LIA.onReady = this.onReady;
    }
  },
};
</script>

<style scoped>
#liascript-preview {
  height: 100%;
  width: 100%;
}
</style>