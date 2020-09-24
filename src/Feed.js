import globalWs from "./ws";
// 处理二进制流

let handleGetBarsMessage = null;

// 处理时间
const filteringTime = (time) => {
  const minuteTime = 60;
  const dayTime = 60 * 60 * 24;
  let longTime = 0;
  switch (time) {
    case "1D":
      longTime = dayTime * 1;
      break;
    case "1W":
      longTime = dayTime * 7;
      break;
    case "1M":
      longTime = dayTime * 30;
      break;
    default:
      longTime = parseInt(time) * minuteTime;
      break;
  }
  return longTime;
};

const transformTime = (time) => {
  let period = "";
  if (
    time.indexOf("D") !== -1 ||
    time.indexOf("W") !== -1 ||
    time.indexOf("M") !== -1
  ) {
    period = time;
  } else if (parseInt(time) < 60) {
    period = `${time}min`;
  } else if (parseInt(time) <= 720) {
    const hourNumber = Math.floor(parseInt(time) / 60);
    period = `${hourNumber}hour`;
  }

  return period;
};
// 处理websocket二进制数据
const handleBuffer = (buffer, onHistoryCallback) => {};
// 处理websocket json数据
const handleJson = (e, onHistoryCallback) => {
  let data = JSON.parse(e);
  if (data.type === "kline") {
    let klineData = data.data.kLine;
    let bars = [];
    for (let i = 0, length = klineData.c.length; i < length; i++) {
      let obj = {};
      obj.high = klineData.h[i];
      obj.open = klineData.o[i];
      obj.low = klineData.l[i];
      obj.close = klineData.c[i];
      obj.volumn = klineData.v[i];
      obj.time = klineData.t[i] * 1000;
      bars.push(obj);
    }
    console.log("ws message---", bars);
    onHistoryCallback(bars);
  }
};

export class Feed {
  constructor(url) {
    this.subs = {};
    this.url = url;
    this.feedConfig = {
      supports_search: true,
      supports_group_request: false,
      supports_marks: true,
      exchanges: [
        { value: "", name: "All Exchanges", desc: "" },
        { value: "XETRA", name: "XETRA", desc: "XETRA" },
        { value: "NSE", name: "NSE", desc: "NSE" },
      ],
      symbols_types: [
        { name: "All types", value: "" },
        { name: "Stock", value: "stock" },
        { name: "Index", value: "index" },
      ],
      supported_resolutions: [
        "1",
        "15",
        "30",
        "60",
        "D",
        "2D",
        "3D",
        "W",
        "3W",
        "M",
        "6M",
      ],
    };
  }
  async onReady(callback) {
    console.log("onready");
    let response = await fetch(this.url + "/config");
    let json = await response.json();
    json.supported_resolutions = [
      "1",
      "5",
      "15",
      "30",
      "60",
      "120",
      "240",
      "360",
      "720",
      "1D",
      "1W",
      "1M",
    ];
    console.log("set json");
    callback(json);
  }
  getBars(
    symbolInfo,
    resolution,
    from,
    to,
    onHistoryCallback,
    onErrorCallback,
    firstDataRequest
  ) {
    console.log("getbars -----", resolution);
    from *= 1000;
    to *= 1000;
    const resolutionTime = filteringTime(resolution);
    const period = transformTime(resolution);
    // getBars websoket事件处理函数，单独提取出来，防止跟其他的onmessage冲突
    // 放在该函数内部，是为了使用onHistoryCallback
    // getBars会多次调用，需要先移除监听
    handleGetBarsMessage &&
      globalWs.removeEventListener("message", handleGetBarsMessage);
    handleGetBarsMessage = (msg) => {
      if (typeof msg.data === "object") {
        handleBuffer(msg.data, onHistoryCallback);
      } else {
        handleJson(msg.data, onHistoryCallback);
      }
    };
    //   使用websocket传输数据
    const wesocketGetData = () => {
      const soketParams = {
        type: "kline",
        period,
        from, // 开始时间戳
        to, // 结束时间戳
        baseCurrencyId: 1, // 基准货币主键
        targetCurrencyId: 2, // 目标货币主键
      };

      if (!window.isSendws) {
        globalWs.send(JSON.stringify(soketParams));
        window.isSendws = true;
      }
      globalWs.addEventListener("message", handleGetBarsMessage);
    };
    //   使用http传输数据
    const httpGetData = () => {};
    wesocketGetData();
  }
  // 数据订阅
  subscribeBars(
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscriberUID,
    onResetCacheNeededCallback
  ) {
    console.log("订阅者", subscriberUID);
    if (this.subs[subscriberUID]) {
      return;
    } else {
      this.subs[subscriberUID] = {
        symbolInfo,
        resolution,
        onRealtimeCallback,
      };
    }
  }
  //   取消订阅
  unsubscribeBars(subscriberUID) {
    delete this.subs[subscriberUID];
  }
  //   用户搜索商品触发
  async searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
    console.log("search symbol", exchange, symbolType);
    let response = await fetch(
      this.url + `search?query=${userInput}&type=stock&exchange=NYSE&limit=15`
    );
    let json = await response.json();
    onResultReadyCallback(json);
  }
  //   商品详情
  async resolveSymbol(
    symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback
  ) {
    console.log("resolve symbol", symbolName);
    let response = await fetch(this.url + `/symbols?symbol=${symbolName}`);
    let json = await response.json();
    onSymbolResolvedCallback({
      name: json.name,
      ticker: json.ticker,
      description: json.description,
      type: json.type,
      session: "24x7",
      holidays: [],
      corrections: [],
      timezone: json.timezone,
      // "exchange-traded": json["exchange-traded"],
      // "exchange-listed": json["exchange-listed"],
      minmov: json.minmov,
      minmov2: json.minmov2,
      pointvalue: json.pointvalue,
      pricescale: json.pricescale,
      has_intraday: true,
      intraday_multipliers: ["1", "5", "15", "30", "60", "240"],
      has_daily: true,
      has_empty_bars: false,
      has_no_volume: false,
      has_weekly_and_monthly: true,
      supported_resolutions: [
        "1",
        "5",
        "15",
        "30",
        "60",
        "120",
        "240",
        "360",
        "720",
        "1D",
        "1W",
        "1M",
      ],
    });
  }
}
