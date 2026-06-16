<template>
  <div class="text-center p-5">
    <hr />

    <p>
      <slot></slot>
    </p>

    <small>
      {{ $t('footer.followUs') }}
      <a href="https://github.com/LiaScript" target="_blank" title="LiaScript on GitHub">
        <i class="bi bi-github"></i>
      </a>
      -
      <a
        href="https://gitter.im/LiaScript/community"
        target="_blank"
        title="LiaScript gitter community chat"
      >
        <i class="bi bi-chat-text"></i>
      </a>
      -
      <a
        href="https://twitter.com/LiaScript"
        target="_blank"
        title="LiaScript on Twitter"
      >
        <i class="bi bi-twitter"></i>
      </a>
      -
      <a
        href="https://www.youtube.com/channel/UCyiTe2GkW_u05HSdvUblGYg"
        target="_blank"
        title="LiaScript YouTube channel"
        ><i class="bi bi-youtube"></i
      ></a>
       -
      <a
        href="https://www.linkedin.com/in/andr%C3%A9-dietrich-73949415/"
        target="_blank"
        title="LinkedIn"
        ><i class="bi bi-linkedin"></i
      ></a>
    </small>
  </div>
</template>
