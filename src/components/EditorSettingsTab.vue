<template>
  <div class="editor-settings-wrapper">

    <!-- Appearance -->
    <div class="toolbar-section editor-section">
      <div class="toolbar-buttons">

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-theme">{{ $t('editor.dark') }}</label>
          <input
            id="es-theme"
            type="checkbox"
            :checked="!lights"
            @change="$emit('toggle-lights')"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-fontsize">{{ $t('editor.size') }}</label>
          <input
            id="es-fontsize"
            class="editor-setting-input"
            type="number"
            min="8" max="32" step="1"
            :value="config.fontSize"
            @change="set('fontSize', +$event.target.value)"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-fontfamily">{{ $t('editor.font') }}</label>
          <select
            id="es-fontfamily"
            class="editor-setting-select"
            :value="config.fontFamily"
            @change="set('fontFamily', $event.target.value)"
          >
            <option value="Monospace">Monospace</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="'Fira Code', monospace">Fira Code</option>
            <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
          </select>
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-linenumbers">{{ $t('editor.lines') }}</label>
          <select
            id="es-linenumbers"
            class="editor-setting-select"
            :value="config.lineNumbers"
            @change="set('lineNumbers', $event.target.value)"
          >
            <option value="on">{{ $t('editor.on') }}</option>
            <option value="off">{{ $t('editor.off') }}</option>
            <option value="relative">{{ $t('editor.relative') }}</option>
          </select>
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-minimap">{{ $t('editor.minimap') }}</label>
          <input
            id="es-minimap"
            type="checkbox"
            :checked="config.minimap"
            @change="set('minimap', $event.target.checked)"
          />
        </div>

      </div>
      <div class="toolbar-label">{{ $t('editor.appearance') }}</div>
    </div>

    <!-- Editing -->
    <div class="toolbar-section editor-section">
      <div class="toolbar-buttons">

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-wordwrap">{{ $t('editor.wrap') }}</label>
          <select
            id="es-wordwrap"
            class="editor-setting-select"
            :value="config.wordWrap"
            @change="set('wordWrap', $event.target.value)"
          >
            <option value="on">{{ $t('editor.on') }}</option>
            <option value="off">{{ $t('editor.off') }}</option>
          </select>
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-tabsize">{{ $t('editor.tab') }}</label>
          <select
            id="es-tabsize"
            class="editor-setting-select"
            :value="config.tabSize"
            @change="set('tabSize', +$event.target.value)"
          >
            <option :value="2">2</option>
            <option :value="4">4</option>
            <option :value="8">8</option>
          </select>
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-spaces">{{ $t('editor.spaces') }}</label>
          <input
            id="es-spaces"
            type="checkbox"
            :checked="config.insertSpaces"
            @change="set('insertSpaces', $event.target.checked)"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-whitespace">{{ $t('editor.whitespace') }}</label>
          <select
            id="es-whitespace"
            class="editor-setting-select"
            :value="config.renderWhitespace"
            @change="set('renderWhitespace', $event.target.value)"
          >
            <option value="none">{{ $t('editor.none') }}</option>
            <option value="boundary">{{ $t('editor.boundary') }}</option>
            <option value="all">{{ $t('editor.all') }}</option>
          </select>
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-folding">{{ $t('editor.folding') }}</label>
          <input
            id="es-folding"
            type="checkbox"
            :checked="config.folding"
            @change="set('folding', $event.target.checked)"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-brackets">{{ $t('editor.brackets') }}</label>
          <input
            id="es-brackets"
            type="checkbox"
            :checked="config.bracketPairColorization"
            @change="set('bracketPairColorization', $event.target.checked)"
          />
        </div>

      </div>
      <div class="toolbar-label">{{ $t('editor.editing') }}</div>
    </div>

    <!-- Behavior -->
    <div class="toolbar-section editor-section">
      <div class="toolbar-buttons">

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-smooth">{{ $t('editor.smooth') }}</label>
          <input
            id="es-smooth"
            type="checkbox"
            :checked="config.smoothScrolling"
            @change="set('smoothScrolling', $event.target.checked)"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-wordsugg">{{ $t('editor.suggestions') }}</label>
          <input
            id="es-wordsugg"
            type="checkbox"
            :checked="config.wordBasedSuggestions"
            @change="set('wordBasedSuggestions', $event.target.checked)"
          />
        </div>

        <div class="editor-setting">
          <label class="editor-setting-label" for="es-cursor">{{ $t('editor.cursor') }}</label>
          <select
            id="es-cursor"
            class="editor-setting-select"
            :value="config.cursorBlinking"
            @change="set('cursorBlinking', $event.target.value)"
          >
            <option value="blink">{{ $t('editor.blink') }}</option>
            <option value="smooth">{{ $t('editor.smooth') }}</option>
            <option value="solid">{{ $t('editor.solid') }}</option>
          </select>
        </div>

      </div>
      <div class="toolbar-label">{{ $t('editor.behavior') }}</div>
    </div>

  </div>
</template>

<script lang="ts">
import type { PropType } from 'vue'
import type { EditorConfig } from '../ts/utils'

export default {
  name: 'EditorSettingsTab',
  props: {
    config: {
      type: Object as PropType<EditorConfig>,
      required: true,
    },
    lights: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['update:config', 'toggle-lights'],
  methods: {
    set(key: keyof EditorConfig, value: any) {
      this.$emit('update:config', { ...this.config, [key]: value })
    },
  },
}
</script>

<style scoped>
.editor-settings-wrapper {
  display: contents;
}

.editor-section {
  padding-top: 8px;
}

.editor-setting {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  flex-shrink: 0;
}

.editor-setting-label {
  font-size: 0.55rem;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  text-align: center;
}

.editor-setting-input {
  width: 46px;
  font-size: 0.78rem;
  padding: 1px 3px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  text-align: center;
  color: inherit;
}

.editor-setting-select {
  font-size: 0.75rem;
  padding: 1px 2px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  max-width: 90px;
  color: inherit;
}

input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  margin: 0;
}
</style>
