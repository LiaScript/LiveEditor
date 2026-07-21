<script lang="ts">
const INIT_CODE = `
var blob = {};

// TODO: Fix this HACK, so that preferBrowserTTS works as expected
if (window.LIA.settings?.preferBrowserTTS || false) {
  window.LIA.settings.preferBrowserTTS = false;
  window.LIA.settings.preferBrowserTTS = true;
}

window.injectHandler = function (param) {
  let url

  console.log("injecting ->", param)

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

  // Media fragment (e.g. "#t=0,5") that has to be re-applied to the blob URL so
  // the author's start/stop time keeps working. Blob URLs lose any fragment.
  const hashIndex = param.src.indexOf("#")
  const fragment = hashIndex >= 0 ? param.src.slice(hashIndex) : ""

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
        if (elem.src == src + fragment) {
          const parent = elem.parentNode
          if (!parent.paused) {
            parent.pause()
          }

          elem.src = url + fragment
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
        if (elem.src == src + fragment) {
          const parent = elem.parentNode
          parent.src = url + fragment
          elem.src = url + fragment
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
          elem.src = url + fragment
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
  // already resolved once -> reuse the cached object URL
  if (blob[src]) {
    window.injectHandler({tag, src})
    return
  }

  // Only truly EXTERNAL resources are fetched over the network. Same-origin
  // URLs (e.g. http://localhost:4321/repo.js) would resolve to the dev server
  // / SPA fallback and inject garbage, so we resolve those from the editor's
  // virtual file system via the parent instead.
  const sameOrigin = src.indexOf(window.location.origin) === 0
  const isExternal =
    !sameOrigin && (src.indexOf("http://") === 0 || src.indexOf("https://") === 0)

  if (isExternal) {
    fetch(src)
      .then(response => response.blob())
      .then(data => {
        window.injectHandler({tag, src, data})
      })
      .catch(error => {
        console.error("could not fetch", src, error)
        parent.postMessage({cmd: 'media.load', param: {tag, src}}, "*")
      })
  } else {
    parent.postMessage({cmd: 'media.load', param: {tag, src}}, "*")
  }
}

// Line-sync (preview cursor -> editor). The runtime only calls window.LIA.lineGoto
// when the parent has assigned it. Same-origin the parent could set it directly;
// cross-origin it cannot reach into this frame, so bridge it over postMessage here.
window.LIA.lineGoto = function (line) {
  parent.postMessage({cmd: 'lia-line', param: line}, "*")
}
`;

export default {
  name: "Preview",

  emits: ["ready", "update", "goto"],

  props: { fetchError: Function },

  data() {
    const previewOrigin: string | undefined = process.env.PREVIEW_ORIGIN;
    let src: string;
    let targetOrigin: string;
    if (previewOrigin) {
      const base = previewOrigin.replace(/\/+$/, "");
      src = base + "/index.html?";
      targetOrigin = new URL(base).origin;
    } else {
      src = window.location.origin + window.location.pathname + "liascript/index.html?";
      // Same-origin fallback: any origin is fine as a target.
      targetOrigin = "*";
    }

    return {
      isReady: false,
      // @ts-ignore
      responsiveVoiceKey: process.env.RESPONSIVEVOICE_KEY,
      messageHandler: null as null | ((event: MessageEvent) => void),
      origin: src,
      targetOrigin,
    };
  },

  methods: {
    // Post a command into the preview iframe (which lives on a separate origin).
    // targetOrigin pins the message to the preview host; inbound messages are
    // validated by event.source (see the mounted() listener).
    postToLia(cmd: string, param: any) {
      const iframe = document.getElementById("liascript-preview") as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage({ cmd, param }, this.targetOrigin);
    },

    // Called once the runtime signals readiness (via the "lia-ready" message).
    // Wires up the outbound bridge and hands the parent a small proxy instead of
    // the runtime's real LIA object (which is now unreachable cross-origin).
    handleReady(definition: any) {
      if (!this.isReady) {
        this.isReady = true;

        // Inject the media/line-sync bridge into the runtime. `eval` is an
        // inbound command the runtime supports.
        this.postToLia("eval", INIT_CODE);

        // only inject if key has been defined
        if (this.responsiveVoiceKey) {
          this.postToLia("responsivevoice", this.responsiveVoiceKey);
        }

        // Proxy exposing just the methods LiaScript.vue drives, forwarded over
        // postMessage. `jit` (re)renders; `gotoLine` scrolls the preview.
        const proxy = {
          jit: (code: string) => this.postToLia("jit", code),
          gotoLine: (line: number) => this.postToLia("goto", line),
        };
        this.$emit("ready", proxy);
      }

      if (definition) {
        this.$emit("update", definition);
      }
    },
  },

  mounted() {
    // Single message listener for everything the preview iframe sends back.
    // Accept only messages from our own preview frame, and — when the preview is
    // on a known separate origin — only from that origin.
    this.messageHandler = (event: MessageEvent) => {
      const iframe = document.getElementById("liascript-preview") as HTMLIFrameElement;
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (this.targetOrigin !== "*" && event.origin !== this.targetOrigin) return;

      const data = event.data || {};
      switch (data.cmd) {
        case "lia-ready": {
          this.handleReady(data.param);
          break;
        }

        case "lia-line": {
          this.$emit("goto", data.param);
          break;
        }

        case "media.load": {
          const param = data.param;
          if (this.fetchError) {
            // Strip any media fragment (e.g. "#t=0,5") so the virtual file
            // system can find the file by its real path. The fragment stays
            // in param.src so injectHandler can re-apply it to the blob URL.
            const lookupSrc = param.src.split("#")[0];
            const blob = this.fetchError(lookupSrc);
            if (blob) {
              this.postToLia("inject", {
                tag: param.tag,
                src: param.src,
                data: new Blob(
                  [blob],
                  param.src.toLowerCase().endsWith(".svg")
                    ? { type: "image/svg+xml" }
                    : {}
                ),
              });
            }
          }
          break;
        }
      }
    };

    window.addEventListener("message", this.messageHandler, false);
  },

  beforeUnmount() {
    if (this.messageHandler) {
      window.removeEventListener("message", this.messageHandler);
      this.messageHandler = null;
    }
  },
};
</script>

<template>
  <iframe id="liascript-preview" :src="origin" allow="autoplay"></iframe>
</template>

<style scoped>
#liascript-preview {
  height: 100%;
  width: 100%;
}
</style>
