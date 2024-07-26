<script lang="ts">
const INIT_CODE = `
var blob = {};

window.injectHandler = function (param) {
  let url

  if (blob[param.src]) {
    url = blob[param.src]
  }
  else if (param.data) {
    url = URL.createObjectURL(param.data)
    blob[param.src] = url
  } else {
    return
  }

  const src = window.location.origin + param.src

  switch (param.tag) {
    case "img": {
      const images = document.querySelectorAll('img,picture')
      for (let i = 0; i < images.length; i++) {
        let image = images[i]
        if (image.src == src) {
          image.src = url

          if (image.onclick) {
            image.onclick = function () {
              window.LIA.img.click(url)
            }
          }
        }
      }

      break
    }

    case "audio": {
      const nodes = document.querySelectorAll('source')

      for (let i = 0; i < nodes.length; i++) {
        let elem = nodes[i]
        if (elem.src == src) {
          const parent = elem.parentNode
          if (!parent.paused) {
            parent.pause()
          }

          elem.src = url
          elem.removeAttribute("onerror")

          // this forces the player to reload
          parent.innerHTML = elem.outerHTML
          parent.play()
        }
      }

      break
    }

    case "video": {
      let nodes = document.querySelectorAll('source')

      for (let i = 0; i < nodes.length; i++) {
        let elem = nodes[i]
        if (elem.src == src) {
          const parent = elem.parentNode
          parent.src = url
          elem.src = url
          parent.load()
          parent.onloadeddata = function() {
            parent.play()
          }
        }
      }

      nodes = document.querySelectorAll('video')

      for (let i = 0; i < nodes.length; i++) {
        let elem = nodes[i]

        if (elem.src == src) {
          elem.src = url
          elem.load()
          elem.onloadeddata = function() {
            elem.play()
          }
        }
      }

      break
    }

    case "script": {
      const tag = document.createElement('script')
      tag.src = url
      document.head.appendChild(tag)

      break
    }

    case "link": {
      const tag = document.createElement('link')
      tag.href = url
      tag.rel = 'stylesheet'
      document.head.appendChild(tag)

      break
    }

    default: {
      console.warn("could not handle tag =>", param)
    }
  }
}


window.LIA.fetchError = (tag, src) => {
  if (src.startsWith("http") || src.startsWith("https")) {
    fetch(src)
      .then(response => response.blob())
      .then(blob => {
        window.injectHandler({tag, src, data: blob})
      })
      .catch(error => {
        console.error("could not fetch", src, error)
        parent.postMessage({cmd: 'media.load', param: {tag, src}}, "*")
      })
  }

  if (blob[src]) {
    window.injectHandler({tag, src})
  } else {
    parent.postMessage({cmd: 'media.load', param: {tag, src}}, "*")
  }
}
`;

export default {
  name: "Preview",

  emits: ["ready", "update", "goto"],

  props: { fetchError: Function },

  data() {
    window.addEventListener(
      "message",
      (event) => {
        switch (event.data.cmd) {
          case "media.load": {
            const param = event.data.param;

            if (this.fetchError) {
              const blob = this.fetchError(param.src);
              //(param.tag, param.src);
              if (blob) {
                this.sendToLia("inject", {
                  tag: param.tag,
                  src: param.src,
                  data: new Blob([blob]),
                });
              }
            }
            break;
          }
        }
      },
      false
    );

    return {
      isReady: false,
      // @ts-ignore
      responsiveVoiceKey: process.env.RESPONSIVEVOICE_KEY,
      sendToLia: null,
    };
  },

  methods: {
    onReady(params: any) {
      const iframe = document.getElementById("liascript-preview") as HTMLIFrameElement;

      if (!this.isReady && iframe && iframe.contentWindow) {
        this.isReady = true;

        // only inject if key has been defined
        if (this.responsiveVoiceKey) {
          iframe.contentWindow["LIA"].injectResposivevoice(this.responsiveVoiceKey);
        }

        // @ts-ignore
        this.$emit("ready", iframe.contentWindow["LIA"]);

        const self = this;
        iframe.contentWindow["LIA"].lineGoto = function (line: number) {
          self.$emit("goto", line);
        };

        this.sendToLia = function (cmd: string, param: any) {
          iframe.contentWindow?.postMessage({ cmd, param }, "*");
        };

        this.sendToLia("eval", INIT_CODE);
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
      if (!iframe.contentWindow["LIA"]) {
        // @ts-ignore
        iframe.contentWindow["LIA"] = {};
      }

      // @ts-ignore
      iframe.contentWindow["LIA"].onReady = this.onReady;
    }
  },
};
</script>

<template>
  <iframe id="liascript-preview" src="./liascript/index.html?" allow="autoplay"></iframe>
</template>

<style scoped>
#liascript-preview {
  height: 100%;
  width: 100%;
}
</style>
