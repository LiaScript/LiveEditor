<template>
  <iframe
    id="liascript-preview"
    src="./liascript/index.html?"
  ></iframe>
</template>

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
          elem.src = url
          elem.removeAttribute("onerror")

          const parent = elem.parentNode
          // this forces the player to reload
          parent.innerHTML = elem.outerHTML
          parent.play()
        }
      }

      break
    }

    case "video": {
      const nodes = document.querySelectorAll('source')
      for (let i = 0; i < nodes.length; i++) {
        let elem = nodes[i]
        if (elem.src == src) {
          const parent = elem.parentNode
          parent.src = url
          parent.load()
          parent.onloadeddata = function() {
            parent.play()
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
  if (blob[src]) {
    window.injectHandler({tag, src})
  } else {
    parent.postMessage({cmd: 'media.load', param: {tag, src}}, "*")
  }
}
`;

function createBlob(dataURI: any) {
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([ab], { type: mimeString });

  return blob;
}

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
                  data: createBlob(blob),
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
      responsiveVoiceKey: process.env.RESPONSIVEVOICE_KEY,
      sendToLia: null,
    };
  },

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