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

  emits: ["ready", "update", "goto"],

  methods: {
    onReady(params: any) {
      const iframe = document.getElementById(
        "liascript-preview"
      ) as HTMLIFrameElement;

      if (!this.isReady && iframe && iframe.contentWindow) {
        this.isReady = true;

        // only inject if key has been defined
        if (this.responsiveVoiceKey) {
          // @ts-ignore
          iframe.contentWindow.LIA.injectResposivevoice(
            this.responsiveVoiceKey
          );
        }

        // @ts-ignore
        this.$emit("ready", iframe.contentWindow.LIA);

        const self = this;
        iframe.contentWindow.LIA.lineGoto = function (line: number) {
          self.$emit("goto", line);
        };
      }

      if (params) {
        this.$emit("update", params);
      }
    },
  },

  mounted() {
    const iframe = document.getElementById("liascript-preview");

    // @ts-ignore
    if (iframe && iframe.contentWindow) {
      // @ts-ignore
      if (!iframe.contentWindow.LIA) {
        // @ts-ignore
        iframe.contentWindow.LIA = {};
      }

      // @ts-ignore
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