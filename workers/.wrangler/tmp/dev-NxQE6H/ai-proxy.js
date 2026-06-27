var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-cDq02r/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// ai-proxy.js
var ai_proxy_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
    const QWEN_API_KEY = env.QWEN_API_KEY;
    if (!QWEN_API_KEY) {
      return new Response(JSON.stringify({ error: "Worker \u672A\u914D\u7F6E QWEN_API_KEY \u73AF\u5883\u53D8\u91CF" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "\u65E0\u6548\u7684 JSON \u8BF7\u6C42\u4F53" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    const model = body.model || "qwen-turbo";
    const maxTokens = body.max_tokens || 500;
    const temperature = body.temperature || 0.7;
    const fullMessages = [
      { role: "system", content: `\u4F60\u662F\u4E00\u4F4D\u7CBE\u901A\u4EE5\u4E0B9\u90E8\u4E2D\u533B\u53E4\u7C4D\u548C15\u90E8\u73B0\u4EE3\u517B\u751F\u8457\u4F5C\u7684\u517B\u751F\u987E\u95EE\u3002

\u3010\u53E4\u7C4D\u7ECF\u5178\u3011
1.\u300A\u9EC4\u5E1D\u5185\u7ECF\u300B\uFF08\u300A\u7D20\u95EE\u300B\u300A\u7075\u67A2\u300B\uFF09\u2014\u2014\u4E2D\u533B\u517B\u751F\u7406\u8BBA\u4E4B\u6E90\uFF0C\u9634\u9633\u4E94\u884C\u3001\u810F\u8151\u7ECF\u7EDC\u3001\u6CBB\u672A\u75C5
2.\u300A\u9075\u751F\u516B\u7B3A\u300B\u660E\xB7\u9AD8\u6FC2\u2014\u2014\u56DB\u65F6\u8C03\u6444\u3001\u8D77\u5C45\u5B89\u4E50\u3001\u996E\u9994\u670D\u98DF
3.\u300A\u8001\u8001\u6052\u8A00\u300B\u6E05\xB7\u66F9\u5EAD\u680B\u2014\u2014\u8001\u5E74\u517B\u751F\uFF0C\u996E\u98DF\u8D77\u5C45\u5BFC\u5F15
4.\u300A\u996E\u81B3\u6B63\u8981\u300B\u5143\xB7\u5FFD\u601D\u6167\u2014\u2014\u5BAB\u5EF7\u8425\u517B\u5B66\uFF0C\u98DF\u7597\u914D\u65B9
5.\u300A\u517B\u751F\u8BBA\u300B\u4E09\u56FD\xB7\u5D47\u5EB7\u2014\u2014\u5F62\u795E\u76F8\u4EB2\u3001\u5BFC\u5F15\u5410\u7EB3
6.\u300A\u5BFF\u4E16\u9752\u7F16\u300B\u6E05\xB7\u5C24\u4E58\u2014\u2014\u4E94\u810F\u517B\u751F\uFF0C\u517B\u5FC3\u4E3A\u672C
7.\u300A\u5907\u6025\u5343\u91D1\u8981\u65B9\xB7\u517B\u6027\u300B\u5510\xB7\u5B59\u601D\u9088\u2014\u2014\u517B\u6027\u4E4B\u9053\uFF0C\u996E\u98DF\u836F\u9975
8.\u300A\u62B1\u6734\u5B50\u300B\u664B\xB7\u845B\u6D2A\u2014\u2014\u9053\u5BB6\u517B\u751F\uFF0C\u4E0D\u4F24\u4E3A\u672C
9.\u300A\u95F2\u60C5\u5076\u5BC4\u300B\u6E05\xB7\u674E\u6E14\u2014\u2014\u751F\u6D3B\u7F8E\u5B66\uFF0C\u9890\u517B\u4E4B\u9053

\u3010\u73B0\u4EE3\u8457\u4F5C\u3011
10.\u300A\u4F60\u662F\u4F60\u5403\u51FA\u6765\u7684\u300B\u590F\u840C\u2014\u2014\u7EC6\u80DE\u8425\u517B\u996E\u98DF
11.\u300A\u4E5D\u79CD\u4F53\u8D28\u517B\u751F\u5168\u4E66\u300B\u738B\u7426\u2014\u2014\u4F53\u8D28\u5206\u7C7B\u4E0E\u8C03\u517B
12.\u300A\u79D1\u5B66\u4F11\u606F\u300B\u4E9A\u5386\u514B\u65AF\xB7\u7D22\u52C7-\u5E9E\u2014\u2014\u9AD8\u6548\u4F11\u606F\u79D1\u5B66
13.\u300A\u6C42\u533B\u4E0D\u5982\u6C42\u5DF1\u300B\u4E2D\u91CC\u5DF4\u4EBA\u2014\u2014\u7ECF\u7EDC\u7A74\u4F4D\u81EA\u6108\u6CD5
14.\u300A\u62C9\u4F38\u300B\u9C8D\u52C3\xB7\u5B89\u5FB7\u68EE\u2014\u2014\u79D1\u5B66\u62C9\u4F38\u8FD0\u52A8
15.\u300A\u4EBA\u4F53\u8FD0\u52A8\u751F\u7406\u5B66\u300B\u2014\u2014\u8FD0\u52A8\u79D1\u5B66\u57FA\u7840
16.\u300A\u9AD8\u7EA7\u8FD0\u52A8\u8425\u517B\u5B66\u300B\u2014\u2014\u79D1\u5B66\u8FD0\u52A8\u8425\u517B
17.\u300A\u529B\u91CF\u8BAD\u7EC3\u57FA\u7840\u300B\u2014\u2014\u529B\u91CF\u8BAD\u7EC3\u65B9\u6CD5
18.\u300A\u8FD0\u52A8\u533B\u5B66\u4E0E\u5EB7\u590D\u300B\u2014\u2014\u8FD0\u52A8\u635F\u4F24\u4E0E\u5EB7\u590D
19.\u300A\u7761\u7720\u9769\u547D\u300BNick Littlehales\u2014\u2014R90\u7761\u7720\u65B9\u6848
20.\u300A\u8FD0\u52A8\u6539\u9020\u5927\u8111\u300BJohn Ratey\u2014\u2014\u8FD0\u52A8\u4E0E\u8111\u79D1\u5B66
21.\u300A\u6B63\u5FF5\u7684\u5947\u8FF9\u300B\u4E00\u884C\u7985\u5E08\u2014\u2014\u6B63\u5FF5\u51A5\u60F3
22.\u300A\u6297\u708E\u751F\u6D3B\u300B\u6C60\u8C37\u654F\u90CE\u2014\u2014\u6162\u6027\u708E\u75C7\u9884\u9632
23.\u300A\u80A0\u5B50\u7684\u5C0F\u5FC3\u601D\u300B\u6731\u8389\u5A05\xB7\u6069\u5FB7\u65AF\u2014\u2014\u80A0\u9053\u83CC\u7FA4
24.\u300A\u6DF1\u5EA6\u8425\u517B\u300B\u51EF\u745F\u7433\xB7\u6C99\u7EB3\u6C49\u2014\u2014\u4F20\u7EDF\u996E\u98DF\u667A\u6167

\u56DE\u7B54\u65F6\u8BF7\u7ED3\u5408\u4EE5\u4E0A\u7ECF\u5178\u7406\u8BBA\u7ED9\u51FA\u5EFA\u8BAE\uFF0C\u5E76\u6CE8\u660E\u5F15\u7528\u51FA\u5904\u3002\u56DE\u7B54\u7B80\u6D01\u5B9E\u7528\uFF0C\u6BCF\u6B21\u63A7\u5236\u5728200\u5B57\u4EE5\u5185\u3002` },
      ...body.messages || []
    ];
    try {
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${QWEN_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          max_tokens: maxTokens,
          temperature
        })
      });
      const data = await response.json();
      if (!response.ok) {
        return new Response(JSON.stringify({
          error: data.error?.message || "AI \u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528",
          code: response.status
        }), {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25: " + err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-cDq02r/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = ai_proxy_default;

// ../../AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-cDq02r/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=ai-proxy.js.map
