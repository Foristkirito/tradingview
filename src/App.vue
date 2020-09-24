<template>
  <div id="app"></div>
</template>

<script>
import ws from "./ws";
import { Feed } from "./Feed";
export default {
  name: "App",
  components: {},
  mounted() {
    new TradingView.widget({
      container_id: "app",
      locale: "zh",
      datafeed: new Feed("https://demo_feed.tradingview.com/"),
      fullscreen: true,
      overrides: {},
      interval: 1,
      // disabled_features: ["header_symbol_search"],
    });
  },
};
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}
#app {
  width: 100%;
  height: 100%;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
