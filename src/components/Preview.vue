<script lang="ts">
import { findDevice, SCALINGS } from "../ts/previewDevices";

const INIT_CODE = `
var blob = {};

// Cache keys are paths as written, which point elsewhere in another document.
// LiaScript also reuses media elements whose markdown src is unchanged, so put
// the original src (and onerror) back to make them fail and get resolved again.
window.LIA.clearMedia = function () {
  blob = {}
  document.querySelectorAll('[data-lia-src]').forEach(function (el) {
    const src = el.dataset.liaSrc
    el.removeAttribute('data-lia-src')
    el.setAttribute('src', src)

    if (el.tagName === 'SOURCE') {
      const media = el.parentNode
      el.setAttribute('onerror', "window.LIA.fetchError('" + media.tagName.toLowerCase() + "','" + src + "')")
      media.removeAttribute('src')
      media.load()
    } else if (el.tagName !== 'IMG') {
      el.load()
    }
  })
};

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

  // resolve like the browser does for element.src ("/../a.png" -> origin + "/a.png")
  const src = new URL(param.src.split("#")[0], window.location.origin).href

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
          image.dataset.liaSrc = image.getAttribute('src')
          image.src = url

          // the hover zoom shows the figure's background-image, not the <img>
          const figure = image.closest('.lia-figure__zoom')
          if (figure) figure.style.backgroundImage = "url('" + url + "')"

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

          elem.dataset.liaSrc = elem.getAttribute('src')
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
          elem.dataset.liaSrc = elem.getAttribute('src')
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
          elem.dataset.liaSrc = elem.getAttribute('src')
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
`;

// Key metadata for synthetic key presses from the device frames' buttons.
// keyCode is legacy but still read by many libraries.
const KEYS: Record<string, { code: string; keyCode: number }> = {
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  Enter: { code: "Enter", keyCode: 13 },
  Backspace: { code: "Backspace", keyCode: 8 },
  SoftLeft: { code: "", keyCode: 0 },
  SoftRight: { code: "", keyCode: 0 },
  Call: { code: "", keyCode: 0 },
  Home: { code: "Home", keyCode: 36 },
  AudioVolumeUp: { code: "AudioVolumeUp", keyCode: 175 },
  AudioVolumeDown: { code: "AudioVolumeDown", keyCode: 174 },
  "*": { code: "NumpadMultiply", keyCode: 106 },
  "#": { code: "", keyCode: 0 },
};
for (let i = 0; i <= 9; i++) KEYS[String(i)] = { code: "Digit" + i, keyCode: 48 + i };

const KEYPAD = [
  ["1", ".,?"], ["2", "abc"], ["3", "def"],
  ["4", "ghi"], ["5", "jkl"], ["6", "mno"],
  ["7", "pqrs"], ["8", "tuv"], ["9", "wxyz"],
  ["*", "+"], ["0", "␣"], ["#", "⇧"],
];

// Elements whose native default action for Enter is a click.
const CLICK_ON_ENTER = 'button, a[href], summary, [role="button"], input[type="button"], input[type="submit"]';

export default {
  name: "Preview",

  emits: ["ready", "update", "goto", "update:landscape", "update:zoom", "update:scaling"],

  props: {
    fetchError: Function,
    device: { type: String, default: "responsive" },
    landscape: { type: Boolean, default: false },
    zoom: { type: String, default: "fit" },
    scaling: { type: Number, default: 1 },
    bar: { type: Boolean, default: false },
  },

  data() {
    return {
      isReady: false,
      // @ts-ignore
      responsiveVoiceKey: process.env.RESPONSIVEVOICE_KEY,
      sendToLia: null,
      origin: window.location.origin + window.location.pathname + "liascript/index.html?",
      KEYPAD,
      SCALINGS,
      scale: 1,
      screenOff: false,
      // unscaled size of the whole device (screen + frame), measured
      frameW: 0,
      frameH: 0,
      observer: null as ResizeObserver | null,
    };
  },

  computed: {
    dev(): any {
      return findDevice(this.device);
    },
    frame(): string {
      return this.dev.frame;
    },
    active(): boolean {
      return this.frame !== "none";
    },
    rotated(): boolean {
      return this.dev.rotatable && this.landscape;
    },
    screenW(): number {
      return this.rotated ? this.dev.height : this.dev.width;
    },
    screenH(): number {
      return this.rotated ? this.dev.width : this.dev.height;
    },
    holderStyle(): any {
      if (!this.active) return {};
      return {
        width: this.frameW * this.scale + "px",
        height: this.frameH * this.scale + "px",
      };
    },
    deviceStyle(): any {
      if (!this.active) return {};
      return {
        transform: `scale(${this.scale})`,
        // frame parts of big screens grow with the screen so they stay visible
        // when scaled down
        "--bezel": Math.round(Math.max(12, this.screenW / 110)) + "px",
        "--sw": this.screenW + "px",
      };
    },
    screenStyle(): any {
      if (!this.active) return {};
      return { width: this.screenW + "px", height: this.screenH + "px" };
    },
    // display scaling: a smaller CSS viewport, magnified to fill the screen
    iframeStyle(): any {
      if (!this.active || this.scaling === 1) return {};
      return {
        width: this.screenW / this.scaling + "px",
        height: this.screenH / this.scaling + "px",
        transform: `scale(${this.scaling})`,
        transformOrigin: "0 0",
      };
    },
    phone(): boolean {
      return this.frame === "notch" || this.frame === "android";
    },
  },

  watch: {
    device() {
      this.screenOff = false;
      this.$nextTick(this.fit);
    },
    landscape() {
      this.$nextTick(this.fit);
    },
    zoom() {
      this.$nextTick(this.fit);
    },
  },

  methods: {
    fit() {
      const viewport = this.$refs.viewport as HTMLElement | undefined;
      const device = this.$refs.device as HTMLElement | undefined;
      if (!this.active || !viewport || !device) {
        this.scale = 1;
        return;
      }

      // offsetWidth/Height ignore the transform, so this is the unscaled size
      this.frameW = device.offsetWidth;
      this.frameH = device.offsetHeight;

      if (this.zoom === "100") {
        this.scale = 1;
        return;
      }

      const PAD = 32; // viewport padding, both sides
      const scale = Math.min(
        1,
        (viewport.clientWidth - PAD) / this.frameW,
        (viewport.clientHeight - PAD) / this.frameH
      );
      this.scale = Math.max(0.02, scale);
    },

    stepScaling(direction: number) {
      const next = SCALINGS[SCALINGS.indexOf(this.scaling) + direction];
      if (next) this.$emit("update:scaling", next);
    },

    // Simulates a hardware key of the device frame inside the preview.
    sendKey(key: string) {
      const iframe = this.$refs.iframe as HTMLIFrameElement | undefined;
      const win = iframe?.contentWindow as any;
      const doc = iframe?.contentDocument;
      if (!iframe || !win || !doc) return;

      const info = KEYS[key] || { code: "", keyCode: 0 };
      const active = doc.activeElement as HTMLElement | null;
      const target = active && active !== doc.body ? active : doc.body;

      const fire = (type: string) => {
        const event = new win.KeyboardEvent(type, {
          key,
          code: info.code,
          bubbles: true,
          cancelable: true,
          view: win,
        });
        // not settable through the init dictionary
        Object.defineProperty(event, "keyCode", { get: () => info.keyCode });
        Object.defineProperty(event, "which", { get: () => info.keyCode });
        return target.dispatchEvent(event);
      };

      const notCancelled = fire("keydown");
      fire("keyup");

      // synthetic events have no default action, so emulate the useful ones
      if (!notCancelled) return win.focus();

      // the element LiaScript scrolls a slide in (same lookup as its Swipe.ts)
      const slide = doc.querySelector('main:not([hidden=""])')?.parentElement;
      const editable = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

      switch (key) {
        case "ArrowUp":
        case "ArrowDown":
          slide?.scrollBy({ top: key === "ArrowUp" ? -80 : 80, behavior: "smooth" });
          break;
        case "Home":
          slide?.scrollTo({ top: 0, behavior: "smooth" });
          break;
        case "Enter":
          if (target !== doc.body && target.matches(CLICK_ON_ENTER)) target.click();
          break;
      }

      // KaiOS: LiaScript only enables its keypad mapping for a KaiOS user agent
      // (liascript Swipe.ts), the simulator has none, so mirror it here.
      // 1/3 are the KaiOS browser's own zoom shortcuts.
      if (this.frame === "kaios" && !editable) {
        switch (key) {
          case "4":
            return this.sendKey("ArrowLeft");
          case "6":
            return this.sendKey("ArrowRight");
          case "2":
          case "8":
            slide?.scrollBy({ top: (key === "2" ? -0.8 : 0.8) * slide.clientHeight, behavior: "smooth" });
            break;
          case "*":
            win.LIA.settings.table_of_contents = !win.LIA.settings.table_of_contents;
            break;
          case "#":
            doc.getElementById("lia-btn-home")?.click();
            break;
          case "1":
          case "3":
            this.stepScaling(key === "1" ? -1 : 1);
            break;
        }
      }

      // keep the real keyboard working inside the preview
      win.focus();
    },

    onMessage(event: MessageEvent) {
      switch (event.data?.cmd) {
        case "media.load": {
          const param = event.data.param;

          if (this.fetchError) {
            // Strip any media fragment (e.g. "#t=0,5") so the virtual file
            // system can find the file by its real path. The fragment stays
            // in param.src so injectHandler can re-apply it to the blob URL.
            const lookupSrc = param.src.split("#")[0];
            const blob = this.fetchError(lookupSrc);
            if (blob) {
              this.sendToLia("inject", {
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
    },

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

  unmounted() {
    window.removeEventListener("message", this.onMessage);
    this.observer?.disconnect();
  },

  mounted() {
    window.addEventListener("message", this.onMessage);
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

    // refit when the pane is resized or the device frame changes size
    this.observer = new ResizeObserver(() => this.fit());
    this.observer.observe(this.$refs.viewport as HTMLElement);
    this.observer.observe(this.$refs.device as HTMLElement);
    this.fit();
  },
};
</script>

<!--
  The iframe must never be moved or re-created: that reloads the LiaScript
  runtime and loses LIA / onReady. So stage > viewport > holder > device >
  body > screen > iframe is always rendered; switching devices only changes
  classes and styles, and frame parts are v-if siblings, never parents.
-->
<template>
  <div class="pv-stage" :class="{ 'pv-active': active }">
    <div v-if="bar" class="pv-bar">
      <slot name="bar"></slot>
      <template v-if="active">
        <span class="pv-meta">
          {{ screenW }}×{{ screenH }}<template v-if="scaling !== 1"> → {{ Math.round(screenW / scaling) }}×{{ Math.round(screenH / scaling) }}</template>
          · {{ Math.round(scale * 100) }} %
        </span>
        <span class="pv-spacer"></span>
        <div class="pv-scaling" role="group" :title="$t('preview.device.scaling')" :aria-label="$t('preview.device.scaling')">
          <button type="button" class="pv-bar-btn" :aria-label="$t('preview.device.scaleDown')" :disabled="scaling === SCALINGS[0]" @click="stepScaling(-1)">
            <i class="bi bi-zoom-out" aria-hidden="true"></i>
          </button>
          <span class="pv-scaling-value">{{ Math.round(scaling * 100) }} %</span>
          <button type="button" class="pv-bar-btn" :aria-label="$t('preview.device.scaleUp')" :disabled="scaling === SCALINGS[SCALINGS.length - 1]" @click="stepScaling(1)">
            <i class="bi bi-zoom-in" aria-hidden="true"></i>
          </button>
        </div>
        <button
          v-if="dev.rotatable"
          type="button"
          class="pv-bar-btn"
          :title="$t('preview.device.rotate')"
          :aria-label="$t('preview.device.rotate')"
          @click="$emit('update:landscape', !landscape)"
        >
          <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
        </button>
        <div class="pv-zoom" role="radiogroup" :aria-label="$t('preview.device.zoom')">
          <button
            type="button"
            role="radio"
            :aria-checked="zoom !== '100'"
            :class="{ active: zoom !== '100' }"
            :title="$t('preview.device.fitTitle')"
            @click="$emit('update:zoom', 'fit')"
          >
            {{ $t('preview.device.fit') }}
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="zoom === '100'"
            :class="{ active: zoom === '100' }"
            :title="$t('preview.device.actualTitle')"
            @click="$emit('update:zoom', '100')"
          >
            100 %
          </button>
        </div>
      </template>
    </div>

    <div ref="viewport" class="pv-viewport" :class="{ 'pv-scroll': active && zoom === '100' }">
      <div class="pv-holder" :style="holderStyle">
        <div
          ref="device"
          class="pv-device"
          :class="[active ? 'pv-frame-' + frame : '', { 'pv-landscape': rotated }]"
          :style="deviceStyle"
        >
          <div v-if="frame === 'beamer'" class="pv-beamer-case"></div>

          <div class="pv-body">
            <button v-if="phone" type="button" class="pv-side pv-side-a" :title="$t('preview.device.keys.volumeUp')" :aria-label="$t('preview.device.keys.volumeUp')" @click="sendKey('AudioVolumeUp')"></button>
            <button v-if="phone" type="button" class="pv-side pv-side-b" :title="$t('preview.device.keys.volumeDown')" :aria-label="$t('preview.device.keys.volumeDown')" @click="sendKey('AudioVolumeDown')"></button>
            <button v-if="phone" type="button" class="pv-side pv-side-c" :title="$t('preview.device.keys.power')" :aria-label="$t('preview.device.keys.power')" :aria-pressed="screenOff" @click="screenOff = !screenOff"></button>
            <span v-if="phone" class="pv-island"></span>
            <span v-if="frame === 'homebutton' || frame === 'tablet'" class="pv-camera"></span>
            <span v-if="frame === 'homebutton'" class="pv-earpiece"></span>
            <div v-if="frame === 'kaios'" class="pv-kaios-top">
              <span class="pv-earpiece"></span>
            </div>

            <div class="pv-screen" :style="screenStyle">
              <iframe id="liascript-preview" ref="iframe" :src="origin" allow="autoplay" :style="iframeStyle"></iframe>
              <div v-if="screenOff && phone" class="pv-screen-off"></div>
            </div>

            <button
              v-if="frame === 'notch'"
              type="button"
              class="pv-home-indicator"
              :title="$t('preview.device.keys.home')"
              :aria-label="$t('preview.device.keys.home')"
              @click="sendKey('Home')"
            ></button>
            <div v-if="frame === 'android'" class="pv-android-nav">
              <button type="button" :title="$t('preview.device.keys.back')" :aria-label="$t('preview.device.keys.back')" @click="sendKey('ArrowLeft')">
                <i class="bi bi-caret-left" aria-hidden="true"></i>
              </button>
              <button type="button" :title="$t('preview.device.keys.home')" :aria-label="$t('preview.device.keys.home')" @click="sendKey('Home')">
                <i class="bi bi-circle" aria-hidden="true"></i>
              </button>
              <span aria-hidden="true"><i class="bi bi-square"></i></span>
            </div>

            <button
              v-if="frame === 'homebutton'"
              type="button"
              class="pv-home-button"
              :title="$t('preview.device.keys.home')"
              :aria-label="$t('preview.device.keys.home')"
              @click="sendKey('Home')"
            ></button>

            <div
              v-if="frame === 'kaios'"
              class="pv-keypad"
              role="group"
              :aria-label="$t('preview.device.keys.keypad')"
            >
              <div class="pv-nav">
                <button type="button" class="pv-key pv-soft pv-soft-left" :title="$t('preview.device.keys.softLeft')" :aria-label="$t('preview.device.keys.softLeft')" @click="sendKey('SoftLeft')">
                  <span class="pv-dash"></span>
                </button>
                <button type="button" class="pv-key pv-call" :title="$t('preview.device.keys.call')" :aria-label="$t('preview.device.keys.call')" @click="sendKey('Call')">
                  <i class="bi bi-telephone-fill" aria-hidden="true"></i>
                </button>

                <div class="pv-dpad">
                  <button type="button" class="pv-dir pv-up" :title="$t('preview.device.keys.up')" :aria-label="$t('preview.device.keys.up')" @click="sendKey('ArrowUp')"><i class="bi bi-caret-up-fill" aria-hidden="true"></i></button>
                  <button type="button" class="pv-dir pv-left" :title="$t('preview.device.keys.left')" :aria-label="$t('preview.device.keys.left')" @click="sendKey('ArrowLeft')"><i class="bi bi-caret-left-fill" aria-hidden="true"></i></button>
                  <button type="button" class="pv-dir pv-right" :title="$t('preview.device.keys.right')" :aria-label="$t('preview.device.keys.right')" @click="sendKey('ArrowRight')"><i class="bi bi-caret-right-fill" aria-hidden="true"></i></button>
                  <button type="button" class="pv-dir pv-down" :title="$t('preview.device.keys.down')" :aria-label="$t('preview.device.keys.down')" @click="sendKey('ArrowDown')"><i class="bi bi-caret-down-fill" aria-hidden="true"></i></button>
                  <button type="button" class="pv-ok" :title="$t('preview.device.keys.ok')" :aria-label="$t('preview.device.keys.ok')" @click="sendKey('Enter')">OK</button>
                </div>

                <button type="button" class="pv-key pv-soft pv-soft-right" :title="$t('preview.device.keys.softRight')" :aria-label="$t('preview.device.keys.softRight')" @click="sendKey('SoftRight')">
                  <span class="pv-dash"></span>
                </button>
                <button type="button" class="pv-key pv-end" :title="$t('preview.device.keys.end')" :aria-label="$t('preview.device.keys.end')" @click="sendKey('Backspace')">
                  <i class="bi bi-telephone-fill" aria-hidden="true"></i>
                </button>
              </div>

              <div class="pv-digits">
                <button
                  v-for="[digit, letters] in KEYPAD"
                  :key="digit"
                  type="button"
                  class="pv-key pv-digit"
                  :aria-label="digit"
                  @click="sendKey(digit)"
                >
                  <span class="pv-digit-main">{{ digit }}</span>
                  <span class="pv-digit-sub">{{ letters }}</span>
                </button>
              </div>
            </div>
          </div>

          <template v-if="frame === 'monitor'">
            <div class="pv-neck"></div>
            <div class="pv-foot"></div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- default: fill the pane exactly like before ------------------------- */
.pv-stage,
.pv-viewport,
.pv-holder,
.pv-device,
.pv-body,
.pv-screen {
  width: 100%;
  height: 100%;
}

.pv-stage {
  display: flex;
  flex-direction: column;
}

.pv-viewport {
  flex: 1 1 auto;
  min-height: 0;
}

#liascript-preview {
  display: block;
  height: 100%;
  width: 100%;
  border: 0;
  background: #fff;
}

/* ---- device simulation -------------------------------------------------- */
.pv-active {
  background-color: #e6e9ed;
  background-image: radial-gradient(#cfd4da 1px, transparent 1px);
  background-size: 18px 18px;
}

.pv-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 30px;
  padding: 0 0.4rem;
  background: #e8e8e8;
  border-bottom: 1px solid #c8c8c8;
  font-size: 0.8rem;
  color: #3b4652;
  white-space: nowrap;
  position: relative;
  z-index: 2;
}

.pv-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--lia-muted, #6c757d);
  font-variant-numeric: tabular-nums;
}

.pv-spacer {
  flex: 1 1 auto;
}

.pv-bar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 0.4rem;
  background: transparent;
  color: inherit;
}

.pv-bar-btn:hover {
  background: #eef1f3;
}

.pv-bar-btn:disabled {
  opacity: 0.35;
}

.pv-scaling {
  display: inline-flex;
  align-items: center;
}

.pv-scaling-value {
  min-width: 3.2em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pv-zoom {
  display: inline-flex;
  padding: 2px;
  background: #eef1f3;
  border-radius: 0.45rem;
}

.pv-zoom button {
  height: 22px;
  padding: 0 0.5rem;
  border: 0;
  border-radius: 0.35rem;
  background: transparent;
  color: inherit;
  font-size: 0.75rem;
}

.pv-zoom button.active {
  background: #fff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(23, 33, 43, 0.12);
}

.pv-active .pv-viewport {
  display: flex;
  padding: 16px;
  overflow: clip;
}

.pv-active .pv-viewport.pv-scroll {
  overflow: auto;
}

/* auto margins center the device, but never push it out of reach when it
   overflows (unlike justify-content: center) */
.pv-active .pv-holder {
  flex: 0 0 auto;
  margin: auto;
}

.pv-active .pv-device {
  width: max-content;
  height: auto;
  transform-origin: 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pv-active .pv-body {
  position: relative;
  width: auto;
  height: auto;
}

/* clip, not hidden: a hidden overflow can still be scrolled by LiaScript's
   scrollIntoView, which reaches out of the iframe and shifts the page up */
.pv-active .pv-screen {
  position: relative;
  overflow: clip;
  background: #fff;
}

.pv-screen-off {
  position: absolute;
  inset: 0;
  background: #000;
}

.pv-device button {
  cursor: pointer;
}

/* ---- smartphones with notch / punch hole -------------------------------- */
.pv-frame-notch .pv-body,
.pv-frame-android .pv-body {
  padding: 14px;
  border-radius: 58px;
  background: #16171a;
  box-shadow:
    inset 0 0 0 2px #3a3c42,
    0 0 0 3px #8c9097,
    0 18px 40px rgba(0, 0, 0, 0.3);
}

.pv-frame-android .pv-body {
  border-radius: 40px;
  padding: 12px 12px 52px;
}

.pv-frame-android.pv-landscape .pv-body {
  padding: 12px 52px 12px 12px;
}

/* 3-button navigation: back, home, recents (recents is only drawn) */
.pv-android-nav {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 56px;
}

.pv-landscape .pv-android-nav {
  top: 0;
  bottom: 0;
  left: auto;
  right: 10px;
  flex-direction: column;
}

.pv-android-nav > * {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #c8ccd2;
}

.pv-android-nav button:hover {
  background: #2c2e33;
  color: #fff;
}

.pv-frame-notch .pv-screen {
  border-radius: 44px;
}

.pv-frame-android .pv-screen {
  border-radius: 30px;
}

.pv-island {
  position: absolute;
  z-index: 2;
  top: 26px;
  left: 50%;
  width: 112px;
  height: 32px;
  margin-left: -56px;
  border-radius: 16px;
  background: #000;
  pointer-events: none;
}

.pv-frame-android .pv-island {
  top: 24px;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  border-radius: 50%;
}

.pv-landscape .pv-island {
  top: 50%;
  left: 26px;
  width: 32px;
  height: 112px;
  margin: -56px 0 0 0;
}

.pv-frame-android.pv-landscape .pv-island {
  left: 24px;
  width: 18px;
  height: 18px;
  margin-top: -9px;
}

.pv-side {
  position: absolute;
  width: 5px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: #8c9097;
}

.pv-side:hover {
  background: #b7bbc1;
}

.pv-side:active {
  background: #5f636a;
}

/* volume up/down on the left, power on the right */
.pv-side-a { left: -8px; top: 180px; height: 60px; }
.pv-side-b { left: -8px; top: 255px; height: 60px; }
.pv-side-c { right: -8px; top: 220px; height: 95px; }

.pv-landscape .pv-side {
  width: auto;
  height: 5px;
}
.pv-landscape .pv-side-a { top: auto; bottom: -8px; left: 180px; width: 60px; }
.pv-landscape .pv-side-b { top: auto; bottom: -8px; left: 255px; width: 60px; }
.pv-landscape .pv-side-c { top: -8px; right: auto; left: 220px; width: 95px; }

.pv-home-indicator {
  position: absolute;
  z-index: 2;
  bottom: 22px;
  left: 50%;
  width: 136px;
  height: 14px;
  margin-left: -68px;
  padding: 0;
  border: 0;
  background: transparent;
}

.pv-home-indicator::before {
  content: "";
  display: block;
  height: 5px;
  margin-top: 5px;
  border-radius: 3px;
  background: rgba(20, 20, 20, 0.75);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
}

.pv-home-indicator:hover::before {
  background: #000;
}

/* ---- smartphone with home button (iPhone SE) ---------------------------- */
.pv-frame-homebutton .pv-body {
  padding: 92px 20px 96px;
  border-radius: 54px;
  background: #1d1e21;
  box-shadow:
    inset 0 0 0 2px #3a3c42,
    0 0 0 3px #b7bbc1,
    0 18px 40px rgba(0, 0, 0, 0.3);
}

.pv-frame-homebutton.pv-landscape .pv-body {
  padding: 20px 96px 20px 92px;
}

.pv-earpiece {
  display: block;
  width: 64px;
  height: 6px;
  border-radius: 3px;
  background: #3a3c42;
}

.pv-frame-homebutton .pv-earpiece {
  position: absolute;
  top: 44px;
  left: 50%;
  margin-left: -32px;
}

.pv-camera {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #33363d;
  box-shadow: inset 0 0 0 2px #22242a;
}

.pv-frame-homebutton .pv-camera {
  top: 42px;
  left: 50%;
  margin-left: -60px;
}

.pv-frame-homebutton.pv-landscape .pv-earpiece {
  top: 50%;
  left: 44px;
  width: 6px;
  height: 64px;
  margin: -32px 0 0 0;
}

.pv-frame-homebutton.pv-landscape .pv-camera {
  top: 50%;
  left: 42px;
  margin: -60px 0 0 0;
}

.pv-home-button {
  position: absolute;
  bottom: 20px;
  left: 50%;
  width: 58px;
  height: 58px;
  margin-left: -29px;
  border-radius: 50%;
  border: 2px solid #4a4d55;
  background: #1d1e21;
}

.pv-home-button:hover {
  border-color: #8c9097;
}

.pv-home-button:active {
  background: #2a2c31;
}

.pv-frame-homebutton.pv-landscape .pv-home-button {
  top: 50%;
  bottom: auto;
  left: auto;
  right: 20px;
  margin: -29px 0 0 0;
}

/* ---- tablet ------------------------------------------------------------- */
.pv-frame-tablet .pv-body {
  padding: 28px;
  border-radius: 40px;
  background: #1d1e21;
  box-shadow:
    inset 0 0 0 2px #3a3c42,
    0 0 0 3px #8c9097,
    0 18px 40px rgba(0, 0, 0, 0.3);
}

.pv-frame-tablet .pv-screen {
  border-radius: 14px;
}

.pv-frame-tablet .pv-camera {
  top: 9px;
  left: 50%;
  margin-left: -5px;
}

.pv-frame-tablet.pv-landscape .pv-camera {
  top: 50%;
  left: 9px;
  margin: -5px 0 0 0;
}

/* ---- KaiOS feature phone ------------------------------------------------ */
.pv-frame-kaios .pv-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 18px 26px;
  border-radius: 34px 34px 46px 46px;
  background: linear-gradient(180deg, #2d3036 0%, #1f2125 100%);
  box-shadow:
    inset 0 0 0 2px #45484f,
    0 18px 40px rgba(0, 0, 0, 0.3);
}

.pv-kaios-top {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 42px;
}

.pv-frame-kaios .pv-screen {
  border: 3px solid #0d0e10;
  border-radius: 4px;
  box-sizing: content-box;
}

.pv-keypad {
  width: 240px;
  margin-top: 16px;
  user-select: none;
}

.pv-key {
  border: 0;
  padding: 0;
  color: #e9ebee;
  background: #3a3d44;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.35);
}

.pv-key:hover {
  background: #474b53;
}

.pv-key:active {
  background: #52565f;
  box-shadow: none;
}

.pv-nav {
  display: grid;
  grid-template-columns: 1fr 104px 1fr;
  grid-template-rows: 44px 44px;
  gap: 8px 10px;
  align-items: center;
}

.pv-soft-left { grid-column: 1; grid-row: 1; }
.pv-call { grid-column: 1; grid-row: 2; }
.pv-dpad { grid-column: 2; grid-row: 1 / span 2; }
.pv-soft-right { grid-column: 3; grid-row: 1; }
.pv-end { grid-column: 3; grid-row: 2; }

.pv-soft,
.pv-call,
.pv-end {
  height: 34px;
  border-radius: 12px;
}

.pv-dash {
  display: inline-block;
  width: 22px;
  height: 3px;
  border-radius: 2px;
  background: #c8ccd2;
  vertical-align: middle;
}

.pv-call .bi { color: #4cd964; }
.pv-end .bi { color: #ff4d4f; display: inline-block; transform: rotate(135deg); }

.pv-dpad {
  position: relative;
  width: 104px;
  height: 96px;
  justify-self: center;
  border-radius: 50%;
  background: #3a3d44;
  box-shadow: inset 0 0 0 2px #2a2c31, inset 0 -3px 0 rgba(0, 0, 0, 0.35);
}

.pv-dir {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0;
  background: transparent;
  color: #c8ccd2;
  font-size: 0.7rem;
}

.pv-dir:hover { color: #fff; }
.pv-dir:active { color: #8fd3ff; }

.pv-up { top: 0; left: 30%; width: 40%; height: 28%; }
.pv-down { bottom: 0; left: 30%; width: 40%; height: 28%; }
.pv-left { left: 0; top: 30%; width: 28%; height: 40%; }
.pv-right { right: 0; top: 30%; width: 28%; height: 40%; }

.pv-ok {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 46px;
  height: 40px;
  margin: -20px 0 0 -23px;
  border: 0;
  border-radius: 50%;
  background: #4a4e57;
  color: #e9ebee;
  font-size: 0.7rem;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.35);
}

.pv-ok:hover { background: #565b65; }
.pv-ok:active { background: #60656f; box-shadow: none; }

.pv-digits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 10px;
  margin-top: 12px;
}

.pv-digit {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 40px;
  border-radius: 14px;
  line-height: 1;
}

.pv-digit-main {
  font-size: 1.05rem;
  font-weight: 600;
}

.pv-digit-sub {
  margin-top: 2px;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  color: #a9aeb6;
  text-transform: uppercase;
}

/* ---- monitors ----------------------------------------------------------- */
.pv-frame-monitor .pv-body {
  padding: var(--bezel);
  border-radius: calc(var(--bezel) * 0.6);
  background: #1f2125;
  box-shadow:
    inset 0 0 0 1px #3a3c42,
    0 18px 40px rgba(0, 0, 0, 0.25);
}

.pv-neck {
  width: calc(var(--sw) * 0.1);
  height: calc(var(--sw) * 0.06);
  background: linear-gradient(90deg, #a9aeb6, #d6d9dd 50%, #a9aeb6);
}

.pv-foot {
  width: calc(var(--sw) * 0.3);
  height: var(--bezel);
  border-radius: calc(var(--bezel) * 0.5) calc(var(--bezel) * 0.5) 3px 3px;
  background: linear-gradient(180deg, #d6d9dd, #9ea3ab);
}

/* ---- projector screen --------------------------------------------------- */
.pv-beamer-case {
  width: calc(var(--sw) + var(--bezel) * 4);
  height: calc(var(--bezel) * 1.6);
  border-radius: calc(var(--bezel) * 0.8);
  background: linear-gradient(180deg, #4a4e57, #2a2c31);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.pv-frame-beamer .pv-body {
  padding: var(--bezel);
  background: #111;
  box-shadow:
    0 0 0 calc(var(--bezel) * 0.8) #f4f5f7,
    0 24px 60px rgba(0, 0, 0, 0.25);
  margin-top: calc(var(--bezel) * 0.8);
}
</style>
