import globalWs from "./ws";
// 处理二进制流
const onWsMessage = (params) => {
  const { data, callback } = params;

  const initFileReader = function() {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      const text = e.srcElement.result;
      callback(text);
    };
    return reader;
  };

  const reader = initFileReader();

  if (reader) {
    reader.readAsText(data);
  }
};

// 处理websocket返回的数据
const dealWebsocket = (params) => {
  let { data, resolutionTime, callback } = params;

  data = JSON.parse(data);
  let dataString = "";
  let dataJSON = "";
  const wsLocalStorage = "wsTradeViewDataHistory";

  console.log(data.type);
  switch (data.type) {
    // k线历史图
    case "kline":
      dataString = JSON.stringify(data.data.kLine);
      break;
    // 实时获取推送
    case "dealSuccess":
      dataString = localStorage.getItem(wsLocalStorage);
      dataJSON = JSON.parse(dataString);
      const lastDataLength = dataJSON.t.length - 1;
      const newData = data.data.kLine;
      const lastDataTime = dataJSON.t[lastDataLength];
      const newDataTime = parseInt(newData.t);

      // 判断当前时间 + 时间间隔 和 最新时间的大小
      if (lastDataTime + resolutionTime > newDataTime) {
        // 替换最后一个
        for (const key in dataJSON) {
          if (key !== "s" && key !== "t" && newData[key]) {
            dataJSON[key][lastDataLength] = newData[key];
          }
        }
      } else {
        for (const key in dataJSON) {
          if (key !== "s" && newData[key]) {
            dataJSON[key].push(newData[key]);
          }
        }
      }
      dataString = JSON.stringify(dataJSON);
      break;
    default:
      break;
  }

  localStorage.setItem(wsLocalStorage, dataString);
  callback(dataString);
};
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
const handleJson = (data, onHistoryCallback) => {
  console.log(data);
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
    let response = await fetch(this.url + "/config");
    let json = await response.json();
    (json.supported_resolutions = [
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
    ]),
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
    from *= 1000;
    to *= 1000;
    const resolutionTime = filteringTime(resolution);
    const period = transformTime(resolution);
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
      // getBars websoket事件处理函数，单独提取出来，防止跟其他的onmessage冲突
      // 放在该函数内部，是为了使用onHistoryCallback
      const handleGetBarsMessage = (msg) => {
        if (typeof msg.data === "object") {
          handleBuffer(msg.data, onHistoryCallback);
        } else {
          handleJson(msg.data, onHistoryCallback);
        }
      };
      // getBars会多次调用，需要先移除监听
      globalWs.removeEventListener("message", handleGetBarsMessage);
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
    let response = await fetch(this.url + `/symbols?symbol=${symbolName}`);
    let json = await response.json();
    onSymbolResolvedCallback({
      name: json.name,
      ticker: json.ticker,
      description: json.description,
      type: json.type,
      session: json.session,
      holidays: [],
      corrections: [],
      timezone: json.timezone,
      "exchange-traded": json["exchange-traded"],
      "exchange-listed": json["exchange-listed"],
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
