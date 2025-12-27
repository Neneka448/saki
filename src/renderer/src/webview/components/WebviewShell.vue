<template>
  <section class="webview">
    <div class="webview__header">
      <h2>Webview Workspace</h2>
      <p>Place your renderer-side webview pages and components here.</p>
    </div>
    <div class="webview__body">
      <div class="webview__card">
        <p class="webview__label">Entry point</p>
        <p class="webview__text">src/renderer/src/webview/pages</p>
      </div>
      <div class="webview__card">
        <p class="webview__label">UI blocks</p>
        <p class="webview__text">src/renderer/src/webview/components</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.webview {
  flex: 1;
  display: grid;
  gap: 16px;
  padding: 24px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 0 0 1px rgba(20, 30, 70, 0.08);
}

.webview__header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.webview__header p {
  margin: 0;
  color: #4c5264;
}

.webview__body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.webview__card {
  padding: 16px;
  border-radius: 16px;
  background: #f6f7fb;
  border: 1px solid rgba(20, 30, 70, 0.08);
}

.webview__label {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6f7485;
}

.webview__text {
  margin: 0;
  font-weight: 600;
}
</style>
