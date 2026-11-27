var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: !0 });
}, __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
)), __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);

// node_modules/web-push/src/web-push-error.js
var WebPushError, init_web_push_error = __esm({
  "node_modules/web-push/src/web-push-error.js"() {
    WebPushError = class extends Error {
      constructor(message, statusCode, headers, body, endpoint) {
        super(message), this.name = "WebPushError", this.statusCode = statusCode, this.headers = headers, this.body = body, this.endpoint = endpoint;
      }
    };
  }
});

// node_modules/web-push/src/web-push-constants.js
var supportedContentEncodings, supportedUrgency, init_web_push_constants = __esm({
  "node_modules/web-push/src/web-push-constants.js"() {
    supportedContentEncodings = {
      AES_GCM: "aesgcm",
      AES_128_GCM: "aes128gcm"
    }, supportedUrgency = {
      VERY_LOW: "very-low",
      LOW: "low",
      NORMAL: "normal",
      HIGH: "high"
    };
  }
});

// node_modules/web-push/src/urlsafe-base64-helper.js
function validate(base64) {
  return /^[A-Za-z0-9\-_]+$/.test(base64);
}
var init_urlsafe_base64_helper = __esm({
  "node_modules/web-push/src/urlsafe-base64-helper.js"() {
  }
});

// node_modules/web-push/src/vapid-helper.js
import crypto from "node:crypto";
import { URL as URL2 } from "node:url";
import asn1 from "asn1.js";
import jws from "jws";
function toPEM(key) {
  return ECPrivateKeyASN.encode({
    version: 1,
    privateKey: key,
    parameters: [1, 2, 840, 10045, 3, 1, 7]
    // prime256v1
  }, "pem", {
    label: "EC PRIVATE KEY"
  });
}
function generateVAPIDKeys() {
  let curve = crypto.createECDH("prime256v1");
  curve.generateKeys();
  let publicKeyBuffer = curve.getPublicKey(), privateKeyBuffer = curve.getPrivateKey();
  if (privateKeyBuffer.length < 32) {
    let padding = Buffer.alloc(32 - privateKeyBuffer.length);
    padding.fill(0), privateKeyBuffer = Buffer.concat([padding, privateKeyBuffer]);
  }
  if (publicKeyBuffer.length < 65) {
    let padding = Buffer.alloc(65 - publicKeyBuffer.length);
    padding.fill(0), publicKeyBuffer = Buffer.concat([padding, publicKeyBuffer]);
  }
  return {
    publicKey: publicKeyBuffer.toString("base64url"),
    privateKey: privateKeyBuffer.toString("base64url")
  };
}
function validateSubject(subject) {
  if (!subject)
    throw new Error("No subject set in vapidDetails.subject.");
  if (typeof subject != "string" || subject.length === 0)
    throw new Error("The subject value must be a string containing an https: URL or mailto: address. " + subject);
  let subjectParseResult;
  try {
    subjectParseResult = new URL2(subject);
  } catch (err) {
    throw new Error(
      "Vapid subject is not a valid URL. " + subject,
      {
        cause: err
      }
    );
  }
  if (!["https:", "mailto:"].includes(subjectParseResult.protocol))
    throw new Error("Vapid subject is not an https: or mailto: URL. " + subject);
  subjectParseResult.hostname === "localhost" && console.warn("Vapid subject points to a localhost web URI, which is unsupported by Apple's push notification server and will result in a BadJwtToken error when sending notifications.");
}
function validatePublicKey(publicKey) {
  if (!publicKey)
    throw new Error("No key set vapidDetails.publicKey");
  if (typeof publicKey != "string")
    throw new Error("Vapid public key is must be a URL safe Base 64 encoded string.");
  if (!validate(publicKey))
    throw new Error('Vapid public key must be a URL safe Base 64 (without "=")');
  if (publicKey = Buffer.from(publicKey, "base64url"), publicKey.length !== 65)
    throw new Error("Vapid public key should be 65 bytes long when decoded.");
}
function validatePrivateKey(privateKey) {
  if (!privateKey)
    throw new Error("No key set in vapidDetails.privateKey");
  if (typeof privateKey != "string")
    throw new Error("Vapid private key must be a URL safe Base 64 encoded string.");
  if (!validate(privateKey))
    throw new Error('Vapid private key must be a URL safe Base 64 (without "=")');
  if (privateKey = Buffer.from(privateKey, "base64url"), privateKey.length !== 32)
    throw new Error("Vapid private key should be 32 bytes long when decoded.");
}
function getFutureExpirationTimestamp(numSeconds) {
  let futureExp = /* @__PURE__ */ new Date();
  return futureExp.setSeconds(futureExp.getSeconds() + numSeconds), Math.floor(futureExp.getTime() / 1e3);
}
function validateExpiration(expiration) {
  if (!Number.isInteger(expiration))
    throw new Error("`expiration` value must be a number");
  if (expiration < 0)
    throw new Error("`expiration` must be a positive integer");
  let maxExpirationTimestamp = getFutureExpirationTimestamp(MAX_EXPIRATION_SECONDS);
  if (expiration >= maxExpirationTimestamp)
    throw new Error("`expiration` value is greater than maximum of 24 hours");
}
function getVapidHeaders(audience, subject, publicKey, privateKey, contentEncoding, expiration) {
  if (!audience)
    throw new Error("No audience could be generated for VAPID.");
  if (typeof audience != "string" || audience.length === 0)
    throw new Error("The audience value must be a string containing the origin of a push service. " + audience);
  try {
    new URL2(audience);
  } catch (err) {
    throw new Error(
      "VAPID audience is not a url. " + audience,
      {
        cause: err
      }
    );
  }
  validateSubject(subject), validatePublicKey(publicKey), validatePrivateKey(privateKey), privateKey = Buffer.from(privateKey, "base64url"), expiration ? validateExpiration(expiration) : expiration = getFutureExpirationTimestamp(DEFAULT_EXPIRATION_SECONDS);
  let header = {
    typ: "JWT",
    alg: "ES256"
  }, jwtPayload = {
    aud: audience,
    exp: expiration,
    sub: subject
  }, jwt = jws.sign({
    header,
    payload: jwtPayload,
    privateKey: toPEM(privateKey)
  });
  if (contentEncoding === supportedContentEncodings.AES_128_GCM)
    return {
      Authorization: "vapid t=" + jwt + ", k=" + publicKey
    };
  if (contentEncoding === supportedContentEncodings.AES_GCM)
    return {
      Authorization: "WebPush " + jwt,
      "Crypto-Key": "p256ecdsa=" + publicKey
    };
  throw new Error("Unsupported encoding type specified.");
}
var DEFAULT_EXPIRATION_SECONDS, MAX_EXPIRATION_SECONDS, ECPrivateKeyASN, init_vapid_helper = __esm({
  "node_modules/web-push/src/vapid-helper.js"() {
    init_web_push_constants();
    init_urlsafe_base64_helper();
    DEFAULT_EXPIRATION_SECONDS = 720 * 60, MAX_EXPIRATION_SECONDS = 1440 * 60, ECPrivateKeyASN = asn1.define("ECPrivateKey", function() {
      this.seq().obj(
        this.key("version").int(),
        this.key("privateKey").octstr(),
        this.key("parameters").explicit(0).objid().optional(),
        this.key("publicKey").explicit(1).bitstr().optional()
      );
    });
  }
});

// node_modules/web-push/src/encryption-helper.js
import crypto2 from "node:crypto";
import ece from "http_ece";
function encrypt(userPublicKey, userAuth, payload, contentEncoding) {
  if (!userPublicKey)
    throw new Error("No user public key provided for encryption.");
  if (typeof userPublicKey != "string")
    throw new Error("The subscription p256dh value must be a string.");
  if (Buffer.from(userPublicKey, "base64url").length !== 65)
    throw new Error("The subscription p256dh value should be 65 bytes long.");
  if (!userAuth)
    throw new Error("No user auth provided for encryption.");
  if (typeof userAuth != "string")
    throw new Error("The subscription auth key must be a string.");
  if (Buffer.from(userAuth, "base64url").length < 16)
    throw new Error("The subscription auth key should be at least 16 bytes long");
  if (typeof payload != "string" && !Buffer.isBuffer(payload))
    throw new Error("Payload must be either a string or a Node Buffer.");
  (typeof payload == "string" || payload instanceof String) && (payload = Buffer.from(payload));
  let localCurve = crypto2.createECDH("prime256v1"), localPublicKey = localCurve.generateKeys(), salt = crypto2.randomBytes(16).toString("base64url"), cipherText = ece.encrypt(payload, {
    version: contentEncoding,
    dh: userPublicKey,
    privateKey: localCurve,
    salt,
    authSecret: userAuth
  });
  return {
    localPublicKey,
    salt,
    cipherText
  };
}
var init_encryption_helper = __esm({
  "node_modules/web-push/src/encryption-helper.js"() {
  }
});

// node_modules/web-push/src/web-push-lib.js
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
var DEFAULT_TTL, gcmAPIKey, vapidDetails, WebPushLib, init_web_push_lib = __esm({
  "node_modules/web-push/src/web-push-lib.js"() {
    init_web_push_error();
    init_vapid_helper();
    init_encryption_helper();
    init_web_push_constants();
    init_urlsafe_base64_helper();
    DEFAULT_TTL = 2419200, gcmAPIKey = "", WebPushLib = class {
      /**
       * When sending messages to a GCM endpoint you need to set the GCM API key
       * by either calling setGMAPIKey() or passing in the API key as an option
       * to sendNotification().
       * @param  {string} apiKey The API key to send with the GCM request.
       */
      setGCMAPIKey(apiKey) {
        if (apiKey === null) {
          gcmAPIKey = null;
          return;
        }
        if (typeof apiKey > "u" || typeof apiKey != "string" || apiKey.length === 0)
          throw new Error("The GCM API Key should be a non-empty string or null.");
        gcmAPIKey = apiKey;
      }
      /**
       * When making requests where you want to define VAPID details, call this
       * method before sendNotification() or pass in the details and options to
       * sendNotification.
       * @param  {string} subject    This must be either a URL or a 'mailto:'
       * address. For example: 'https://my-site.com/contact' or
       * 'mailto: contact@my-site.com'
       * @param  {string} publicKey  The public VAPID key, a URL safe, base64 encoded string
       * @param  {string} privateKey The private VAPID key, a URL safe, base64 encoded string.
       */
      setVapidDetails(subject, publicKey, privateKey) {
        if (arguments.length === 1 && arguments[0] === null) {
          vapidDetails = null;
          return;
        }
        validateSubject(subject), validatePublicKey(publicKey), validatePrivateKey(privateKey), vapidDetails = {
          subject,
          publicKey,
          privateKey
        };
      }
      /**
       * To get the details of a request to trigger a push message, without sending
       * a push notification call this method.
       *
       * This method will throw an error if there is an issue with the input.
       * @param  {PushSubscription} subscription The PushSubscription you wish to
       * send the notification to.
       * @param  {string|Buffer} [payload]       The payload you wish to send to the
       * the user.
       * @param  {Object} [options]              Options for the GCM API key and
       * vapid keys can be passed in if they are unique for each notification you
       * wish to send.
       * @return {Object}                       This method returns an Object which
       * contains 'endpoint', 'method', 'headers' and 'payload'.
       */
      generateRequestDetails(subscription, payload, options) {
        if (!subscription || !subscription.endpoint)
          throw new Error("You must pass in a subscription with at least an endpoint.");
        if (typeof subscription.endpoint != "string" || subscription.endpoint.length === 0)
          throw new Error("The subscription endpoint must be a string with a valid URL.");
        if (payload && (typeof subscription != "object" || !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth))
          throw new Error("To send a message with a payload, the subscription must have 'auth' and 'p256dh' keys.");
        let currentGCMAPIKey = gcmAPIKey, currentVapidDetails = vapidDetails, timeToLive = DEFAULT_TTL, extraHeaders = {}, contentEncoding = supportedContentEncodings.AES_128_GCM, urgency = supportedUrgency.NORMAL, topic, proxy, agent, timeout;
        if (options) {
          let validOptionKeys = [
            "headers",
            "gcmAPIKey",
            "vapidDetails",
            "TTL",
            "contentEncoding",
            "urgency",
            "topic",
            "proxy",
            "agent",
            "timeout"
          ], optionKeys = Object.keys(options);
          for (let i = 0; i < optionKeys.length; i += 1) {
            let optionKey = optionKeys[i];
            if (!validOptionKeys.includes(optionKey))
              throw new Error("'" + optionKey + "' is an invalid option. The valid options are ['" + validOptionKeys.join("', '") + "'].");
          }
          if (options.headers) {
            extraHeaders = options.headers;
            let duplicates = Object.keys(extraHeaders).filter(function(header) {
              return typeof options[header] < "u";
            });
            if (duplicates.length > 0)
              throw new Error("Duplicated headers defined [" + duplicates.join(",") + "]. Please either define the header in thetop level options OR in the 'headers' key.");
          }
          if (options.gcmAPIKey && (currentGCMAPIKey = options.gcmAPIKey), options.vapidDetails !== void 0 && (currentVapidDetails = options.vapidDetails), options.TTL !== void 0 && (timeToLive = Number(options.TTL), timeToLive < 0))
            throw new Error("TTL should be a number and should be at least 0");
          if (options.contentEncoding)
            if (options.contentEncoding === supportedContentEncodings.AES_128_GCM || options.contentEncoding === supportedContentEncodings.AES_GCM)
              contentEncoding = options.contentEncoding;
            else
              throw new Error("Unsupported content encoding specified.");
          if (options.urgency)
            if (options.urgency === supportedUrgency.VERY_LOW || options.urgency === supportedUrgency.LOW || options.urgency === supportedUrgency.NORMAL || options.urgency === supportedUrgency.HIGH)
              urgency = options.urgency;
            else
              throw new Error("Unsupported urgency specified.");
          if (options.topic) {
            if (!validate(options.topic))
              throw new Error("Unsupported characters set use the URL or filename-safe Base64 characters set");
            if (options.topic.length > 32)
              throw new Error("use maximum of 32 characters from the URL or filename-safe Base64 characters set");
            topic = options.topic;
          }
          options.proxy && (typeof options.proxy == "string" || typeof options.proxy.host == "string" ? proxy = options.proxy : console.warn("Attempt to use proxy option, but invalid type it should be a string or proxy options object.")), options.agent && (options.agent instanceof https.Agent ? (proxy && console.warn("Agent option will be ignored because proxy option is defined."), agent = options.agent) : console.warn("Wrong type for the agent option, it should be an instance of https.Agent.")), typeof options.timeout == "number" && (timeout = options.timeout);
        }
        typeof timeToLive > "u" && (timeToLive = DEFAULT_TTL);
        let requestDetails = {
          method: "POST",
          headers: {
            TTL: timeToLive
          }
        };
        Object.keys(extraHeaders).forEach(function(header) {
          requestDetails.headers[header] = extraHeaders[header];
        });
        let requestPayload = null;
        if (payload) {
          let encrypted = encrypt(subscription.keys.p256dh, subscription.keys.auth, payload, contentEncoding);
          requestDetails.headers["Content-Length"] = encrypted.cipherText.length, requestDetails.headers["Content-Type"] = "application/octet-stream", contentEncoding === supportedContentEncodings.AES_128_GCM ? requestDetails.headers["Content-Encoding"] = supportedContentEncodings.AES_128_GCM : contentEncoding === supportedContentEncodings.AES_GCM && (requestDetails.headers["Content-Encoding"] = supportedContentEncodings.AES_GCM, requestDetails.headers.Encryption = "salt=" + encrypted.salt, requestDetails.headers["Crypto-Key"] = "dh=" + encrypted.localPublicKey.toString("base64url")), requestPayload = encrypted.cipherText;
        } else
          requestDetails.headers["Content-Length"] = 0;
        let isGCM = subscription.endpoint.startsWith("https://android.googleapis.com/gcm/send"), isFCM = subscription.endpoint.startsWith("https://fcm.googleapis.com/fcm/send");
        if (isGCM)
          currentGCMAPIKey ? requestDetails.headers.Authorization = "key=" + currentGCMAPIKey : console.warn("Attempt to send push notification to GCM endpoint, but no GCM key is defined. Please use setGCMApiKey() or add 'gcmAPIKey' as an option.");
        else if (currentVapidDetails) {
          let parsedUrl = new URL(subscription.endpoint), audience = parsedUrl.protocol + "//" + parsedUrl.host, vapidHeaders = getVapidHeaders(
            audience,
            currentVapidDetails.subject,
            currentVapidDetails.publicKey,
            currentVapidDetails.privateKey,
            contentEncoding
          );
          requestDetails.headers.Authorization = vapidHeaders.Authorization, contentEncoding === supportedContentEncodings.AES_GCM && (requestDetails.headers["Crypto-Key"] ? requestDetails.headers["Crypto-Key"] += ";" + vapidHeaders["Crypto-Key"] : requestDetails.headers["Crypto-Key"] = vapidHeaders["Crypto-Key"]);
        } else isFCM && currentGCMAPIKey && (requestDetails.headers.Authorization = "key=" + currentGCMAPIKey);
        return requestDetails.headers.Urgency = urgency, topic && (requestDetails.headers.Topic = topic), requestDetails.body = requestPayload, requestDetails.endpoint = subscription.endpoint, proxy && (requestDetails.proxy = proxy), agent && (requestDetails.agent = agent), timeout && (requestDetails.timeout = timeout), requestDetails;
      }
      /**
       * To send a push notification call this method with a subscription, optional
       * payload and any options.
       * @param  {PushSubscription} subscription The PushSubscription you wish to
       * send the notification to.
       * @param  {string|Buffer} [payload]       The payload you wish to send to the
       * the user.
       * @param  {Object} [options]              Options for the GCM API key and
       * vapid keys can be passed in if they are unique for each notification you
       * wish to send.
       * @return {Promise}                       This method returns a Promise which
       * resolves if the sending of the notification was successful, otherwise it
       * rejects.
       */
      sendNotification(subscription, payload, options) {
        let requestDetails;
        try {
          requestDetails = this.generateRequestDetails(subscription, payload, options);
        } catch (err) {
          return Promise.reject(err);
        }
        return new Promise(function(resolve, reject) {
          let httpsOptions = {}, urlParts = new URL(requestDetails.endpoint);
          httpsOptions.hostname = urlParts.hostname, httpsOptions.port = urlParts.port, httpsOptions.path = urlParts.pathname + urlParts.search, httpsOptions.headers = requestDetails.headers, httpsOptions.method = requestDetails.method, requestDetails.timeout && (httpsOptions.timeout = requestDetails.timeout), requestDetails.agent && (httpsOptions.agent = requestDetails.agent), requestDetails.proxy && (httpsOptions.agent = new HttpsProxyAgent(requestDetails.proxy));
          let pushRequest = https.request(httpsOptions, function(pushResponse) {
            let responseText = "";
            pushResponse.on("data", function(chunk) {
              responseText += chunk;
            }), pushResponse.on("end", function() {
              pushResponse.statusCode < 200 || pushResponse.statusCode > 299 ? reject(new WebPushError(
                "Received unexpected response code",
                pushResponse.statusCode,
                pushResponse.headers,
                responseText,
                requestDetails.endpoint
              )) : resolve({
                statusCode: pushResponse.statusCode,
                body: responseText,
                headers: pushResponse.headers
              });
            });
          });
          requestDetails.timeout && pushRequest.on("timeout", function() {
            pushRequest.destroy(new Error("Socket timeout"));
          }), pushRequest.on("error", function(e) {
            reject(e);
          }), requestDetails.body && pushRequest.write(requestDetails.body), pushRequest.end();
        });
      }
    };
  }
});

// node_modules/web-push/src/index.js
var src_exports = {};
__export(src_exports, {
  WebPushError: () => WebPushError,
  encrypt: () => encrypt,
  generateRequestDetails: () => generateRequestDetails,
  generateVAPIDKeys: () => generateVAPIDKeys,
  getVapidHeaders: () => getVapidHeaders,
  sendNotification: () => sendNotification,
  setGCMAPIKey: () => setGCMAPIKey,
  setVapidDetails: () => setVapidDetails,
  supportedContentEncodings: () => supportedContentEncodings
});
var webPush, setGCMAPIKey, setVapidDetails, generateRequestDetails, sendNotification, init_src = __esm({
  "node_modules/web-push/src/index.js"() {
    init_web_push_lib();
    init_web_push_error();
    init_encryption_helper();
    init_vapid_helper();
    init_web_push_constants();
    webPush = new WebPushLib(), setGCMAPIKey = webPush.setGCMAPIKey, setVapidDetails = webPush.setVapidDetails, generateRequestDetails = webPush.generateRequestDetails, sendNotification = webPush.sendNotification.bind(webPush);
  }
});

// src/server/webpush.cjs
var require_webpush = __commonJS({
  "src/server/webpush.cjs"(exports, module) {
    "use strict";
    module.exports = (init_src(), __toCommonJS(src_exports));
  }
});

// server.ts
var import_webpush = __toESM(require_webpush(), 1);
import express from "express";
import compression from "compression";
import crypto3 from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

// src/server/store.ts
import { createClient } from "@supabase/supabase-js";
var TABLE = "pk_kv", client = null, clientResolved = !1;
function getSupabase() {
  if (clientResolved) return client;
  clientResolved = !0;
  let url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    client = createClient(url, key, {
      auth: { persistSession: !1, autoRefreshToken: !1 }
    });
  } catch {
    client = null;
  }
  return client;
}
function isSupabaseEnabled() {
  return getSupabase() !== null;
}
function isRedisEnabled() {
  return isSupabaseEnabled();
}
function sb() {
  return getSupabase();
}
async function kvGet(namespace, key) {
  let c = sb();
  if (!c) return null;
  try {
    let { data, error } = await c.from(TABLE).select("value, expires_at").eq("namespace", namespace).eq("key", key).maybeSingle();
    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())
      return await c.from(TABLE).delete().eq("namespace", namespace).eq("key", key), null;
    try {
      return JSON.parse(data.value);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
async function kvSet(namespace, key, value, ttlMs) {
  let c = sb();
  if (c)
    try {
      let expires_at = ttlMs ? new Date(Date.now() + ttlMs).toISOString() : null;
      await c.from(TABLE).upsert(
        {
          namespace,
          key,
          value: JSON.stringify(value),
          expires_at,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        { onConflict: "namespace,key" }
      );
    } catch {
    }
}
async function kvDel(namespace, key) {
  let c = sb();
  if (c)
    try {
      await c.from(TABLE).delete().eq("namespace", namespace).eq("key", key);
    } catch {
    }
}
var STATE_NS = "state", STATE_KEYS_KEY = "__keys", STATE_REV_KEY = "__revision", STATE_UPDATED_KEY = "__updatedAt";
async function hydrateState() {
  let c = sb();
  if (!c) return null;
  try {
    let { data, error } = await c.from(TABLE).select("key, value, expires_at").eq("namespace", STATE_NS);
    if (error || !data) return null;
    let map = {};
    for (let row of data)
      row.expires_at && new Date(row.expires_at).getTime() <= Date.now() || (map[row.key] = row.value);
    let revision = map[STATE_REV_KEY] && Number(JSON.parse(map[STATE_REV_KEY])) || 0, updatedAt = map[STATE_UPDATED_KEY] && typeof JSON.parse(map[STATE_UPDATED_KEY]) == "string" ? JSON.parse(map[STATE_UPDATED_KEY]) : (/* @__PURE__ */ new Date()).toISOString(), keysList = map[STATE_KEYS_KEY] ? JSON.parse(map[STATE_KEYS_KEY]) || [] : [], keys = {};
    for (let name of keysList) {
      let v = map[`key:${name}`];
      if (typeof v == "string")
        try {
          keys[name] = JSON.parse(v);
        } catch {
          keys[name] = v;
        }
    }
    for (let name of Object.keys(keys)) {
      let raw = keys[name];
    }
    return { revision, updatedAt, keys };
  } catch {
    return null;
  }
}
async function persistStateChanges(changes) {
  if (!sb()) return null;
  try {
    let entries = Object.entries(changes), currentKeysRaw = await kvGet(STATE_NS, STATE_KEYS_KEY), currentKeys = Array.isArray(currentKeysRaw) ? currentKeysRaw : [], keySet = new Set(currentKeys);
    for (let [key] of entries) keySet.add(key);
    await Promise.all([
      ...entries.map(([key, value]) => kvSet(STATE_NS, `key:${key}`, value)),
      kvSet(STATE_NS, STATE_KEYS_KEY, [...keySet])
    ]);
    let revRaw = await kvGet(STATE_NS, STATE_REV_KEY), nextRev = (Number(revRaw) || 0) + 1;
    return await kvSet(STATE_NS, STATE_REV_KEY, nextRev), await kvSet(STATE_NS, STATE_UPDATED_KEY, (/* @__PURE__ */ new Date()).toISOString()), nextRev;
  } catch {
    return null;
  }
}
async function getSessionRemote(sid) {
  return kvGet("session", sid);
}
async function putSessionRemote(sid, session, ttlMs) {
  await kvSet("session", sid, session, ttlMs);
}
async function delSessionRemote(sid) {
  await kvDel("session", sid);
}
async function readAdminCredentialRemote() {
  return kvGet("auth", "admin");
}
async function writeAdminCredentialRemote(record) {
  await kvSet("auth", "admin", record);
}
async function readUserCredentialsRemote() {
  return kvGet("auth", "users");
}
async function writeUserCredentialsRemote(disk) {
  await kvSet("auth", "users", disk);
}
async function readPushSubsRemote() {
  return kvGet("push", "subs");
}
async function writePushSubsRemote(disk) {
  await kvSet("push", "subs", disk);
}
async function readPushSentRemote() {
  return kvGet("push", "sent");
}
async function writePushSentRemote(disk) {
  await kvSet("push", "sent", disk);
}
async function readVapidRemote() {
  let parsed = await kvGet("push", "vapid");
  return parsed && typeof parsed.publicKey == "string" && typeof parsed.privateKey == "string" ? { publicKey: parsed.publicKey, privateKey: parsed.privateKey } : null;
}
async function writeVapidRemote(keys) {
  await kvSet("push", "vapid", keys);
}
async function readBrandRegistryRemote() {
  return kvGet("brand", "registry");
}
async function writeBrandRegistryRemote(registry) {
  await kvSet("brand", "registry", registry);
}
async function putBrandAssetRemote(fileName, base64, mimeType) {
  await kvSet("brand", `asset:${fileName}`, { mimeType, base64 });
}
async function getBrandAssetRemote(fileName) {
  let parsed = await kvGet("brand", `asset:${fileName}`);
  return !parsed || typeof parsed.base64 != "string" ? null : {
    buffer: Buffer.from(parsed.base64, "base64"),
    mimeType: typeof parsed.mimeType == "string" ? parsed.mimeType : "application/octet-stream"
  };
}

// server.ts
var webpush = import_webpush.default, PORT = Number(process.env.PORT) || 3e3, IS_PRODUCTION = process.env.NODE_ENV === "production", ALLOW_HTTP = process.env.PK_ALLOW_HTTP === "true", MAX_LOGO_BYTES = 5 * 1024 * 1024, STORAGE_DIR = path.resolve(process.cwd(), "storage", "brand-identity"), ASSETS_DIR = path.join(STORAGE_DIR, "assets"), REGISTRY_PATH = path.join(STORAGE_DIR, "registry.json"), REALTIME_DIR = path.resolve(process.cwd(), "storage", "realtime"), REALTIME_STATE_PATH = path.join(REALTIME_DIR, "state.json"), REALTIME_MAX_KEYS_PER_REQUEST = 40, PUBLIC_SNAPSHOT_KEYS = [
  "pk_detail_settings_v1",
  "pk_detail_services_v1",
  "pk_detail_service_categories_v1",
  "pk_detail_portal_config_v1"
], SECURITY_DIR = path.resolve(process.cwd(), "storage", "security"), AUTH_CREDENTIAL_PATH = path.join(SECURITY_DIR, "admin-credential.json"), USER_CREDENTIALS_PATH = path.join(SECURITY_DIR, "user-credentials.json"), SECURITY_LOG_PATH = path.join(SECURITY_DIR, "security.log"), SESSION_COOKIE = "pk_sid", SESSION_TTL_MS = 480 * 60 * 1e3, SESSION_TOUCH_MS = 60 * 1e3, LOGIN_WINDOW_MS = 600 * 1e3, LOGIN_MAX_ATTEMPTS = 5, LOGIN_LOCK_MS = 900 * 1e3, MAX_AUTH_BODY_BYTES = 4 * 1024, authSessions = /* @__PURE__ */ new Map(), loginAttempts = /* @__PURE__ */ new Map(), credentialCache, userCredentialsCache = null;
function ensureSecurityDir() {
  fs.mkdirSync(SECURITY_DIR, { recursive: !0 });
}
function secureLog(event, details) {
  try {
    ensureSecurityDir();
    let entry = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      event,
      ...details
    };
    fs.appendFileSync(SECURITY_LOG_PATH, `${JSON.stringify(entry)}
`, "utf8");
  } catch {
  }
}
function maskEmail(email) {
  return `sha256:${crypto3.createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 16)}`;
}
function parseCookieHeader(header) {
  let out = {};
  if (!header) return out;
  for (let part of header.split(";")) {
    let idx = part.indexOf("=");
    if (idx <= 0) continue;
    let key = part.slice(0, idx).trim(), value = part.slice(idx + 1).trim();
    if (key)
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
  }
  return out;
}
async function persistSession(session) {
  authSessions.set(session.id, session), isRedisEnabled() && await putSessionRemote(session.id, session, SESSION_TTL_MS);
}
async function destroySession(sid) {
  authSessions.delete(sid), isRedisEnabled() && await delSessionRemote(sid);
}
async function getSession(req) {
  let sid = parseCookieHeader(req.header("cookie"))[SESSION_COOKIE];
  if (!sid || !/^[A-Za-z0-9_-]{32,128}$/.test(sid)) return null;
  let now = Date.now(), session = authSessions.get(sid) || null;
  return !session && isRedisEnabled() && (session = await getSessionRemote(sid)), session ? session.lastSeenAt + SESSION_TTL_MS <= now ? (await destroySession(sid), null) : (now - session.lastSeenAt > SESSION_TOUCH_MS ? (session.lastSeenAt = now, await persistSession(session)) : authSessions.has(sid) || authSessions.set(sid, session), session) : null;
}
function sessionCookie(sid, req) {
  let secure = requestIsSecure(req) || IS_PRODUCTION, parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sid)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1e3)}`
  ];
  return secure && parts.push("Secure"), parts.join("; ");
}
function clearSessionCookie(req) {
  let secure = requestIsSecure(req) || IS_PRODUCTION;
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}
async function pruneSessions() {
  let now = Date.now();
  for (let [sid, session] of authSessions)
    session.lastSeenAt + SESSION_TTL_MS <= now && await destroySession(sid);
}
async function requireAuth(req, res, next) {
  let session = await getSession(req);
  if (!session) {
    res.setHeader("Cache-Control", "no-store"), res.status(401).json({ error: "Autentica\xE7\xE3o necess\xE1ria." });
    return;
  }
  req.pkSession = session, next();
}
function requireRole(roles) {
  return async (req, res, next) => {
    let session = req.pkSession || await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Autentica\xE7\xE3o necess\xE1ria." });
      return;
    }
    if (!roles.includes(session.userRole)) {
      secureLog("auth.forbidden_role", {
        userId: session.userId,
        role: session.userRole,
        path: req.path,
        ip: req.ip
      }), res.status(403).json({ error: "Permiss\xE3o insuficiente para esta opera\xE7\xE3o." });
      return;
    }
    req.pkSession = session, next();
  };
}
function fingerprintPin(pin) {
  return crypto3.createHash("sha256").update(pin).digest("hex");
}
function readCredential() {
  if (isRedisEnabled()) return credentialCache ?? null;
  try {
    if (!fs.existsSync(AUTH_CREDENTIAL_PATH)) return null;
    let parsed = JSON.parse(fs.readFileSync(AUTH_CREDENTIAL_PATH, "utf8"));
    return parsed.algorithm !== "scrypt" || typeof parsed.salt != "string" || typeof parsed.hash != "string" || typeof parsed.pinFingerprint != "string" ? null : parsed;
  } catch {
    return null;
  }
}
async function writeCredential(pin) {
  let salt = crypto3.randomBytes(16).toString("hex"), hash = crypto3.scryptSync(pin, salt, 64).toString("hex"), record = {
    algorithm: "scrypt",
    salt,
    hash,
    pinFingerprint: fingerprintPin(pin),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (credentialCache = record, isRedisEnabled())
    return await writeAdminCredentialRemote(record), record;
  ensureSecurityDir();
  let tmp = `${AUTH_CREDENTIAL_PATH}.tmp`;
  return fs.writeFileSync(tmp, JSON.stringify(record, null, 2), "utf8"), fs.renameSync(tmp, AUTH_CREDENTIAL_PATH), record;
}
function currentAdminPin() {
  let disk = readRealtimeDisk(), portal = parseRealtimeJson(
    disk.keys.pk_detail_portal_config_v1,
    {}
  );
  return (typeof portal.kioskPin == "string" ? portal.kioskPin.trim() : "") || "1234";
}
async function ensureCredentialSynced() {
  let pin = currentAdminPin(), existing = readCredential();
  return existing && existing.pinFingerprint === fingerprintPin(pin) ? existing : writeCredential(pin);
}
function verifyPin(candidate, record) {
  try {
    let expected = Buffer.from(record.hash, "hex"), actual = crypto3.scryptSync(candidate, record.salt, expected.length);
    return expected.length === actual.length && crypto3.timingSafeEqual(expected, actual);
  } catch {
    return !1;
  }
}
function readUserCredentials() {
  if (isRedisEnabled()) return userCredentialsCache ?? { version: 1, users: {} };
  try {
    if (!fs.existsSync(USER_CREDENTIALS_PATH)) return { version: 1, users: {} };
    let parsed = JSON.parse(fs.readFileSync(USER_CREDENTIALS_PATH, "utf8"));
    return {
      version: 1,
      users: parsed.users && typeof parsed.users == "object" ? parsed.users : {}
    };
  } catch {
    return { version: 1, users: {} };
  }
}
async function writeUserCredentials(disk) {
  if (userCredentialsCache = disk, isRedisEnabled()) {
    await writeUserCredentialsRemote(disk);
    return;
  }
  ensureSecurityDir();
  let tmp = `${USER_CREDENTIALS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(disk, null, 2), { encoding: "utf8", mode: 384 }), fs.renameSync(tmp, USER_CREDENTIALS_PATH);
}
async function setUserCredential(userId, password) {
  let salt = crypto3.randomBytes(16).toString("hex"), hash = crypto3.scryptSync(password, salt, 64).toString("hex"), disk = readUserCredentials();
  disk.users[userId] = {
    algorithm: "scrypt",
    salt,
    hash,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, await writeUserCredentials(disk);
}
async function removeUserCredential(userId) {
  let disk = readUserCredentials();
  return disk.users[userId] ? (delete disk.users[userId], await writeUserCredentials(disk), !0) : !1;
}
function verifyUserCredential(userId, candidate) {
  let record = readUserCredentials().users[userId];
  if (!record) return !1;
  try {
    let expected = Buffer.from(record.hash, "hex"), actual = crypto3.scryptSync(candidate, record.salt, expected.length);
    return expected.length === actual.length && crypto3.timingSafeEqual(expected, actual);
  } catch {
    return !1;
  }
}
function passwordPolicyError(password) {
  return password.length < 8 ? "A senha deve ter pelo menos 8 caracteres." : password.length > 128 ? "A senha \xE9 muito longa (m\xE1ximo 128 caracteres)." : /^(.)\1+$/.test(password) ? "A senha n\xE3o pode ser um caractere repetido." : ["12345678", "senha123", "password", "admin123", "pkdetail"].includes(password.toLowerCase()) ? "Escolha uma senha menos previs\xEDvel." : null;
}
function allUsersFromState() {
  let disk = readRealtimeDisk();
  return parseRealtimeJson(
    disk.keys.pk_detail_users_v1,
    []
  ).filter((user) => !!user && typeof user == "object");
}
function loginRateKey(req, email) {
  return `${req.ip || "unknown"}|${email.toLowerCase().trim()}`;
}
function loginIsLocked(key) {
  let now = Date.now(), entry = loginAttempts.get(key);
  return entry ? entry.lockedUntil > now ? entry.lockedUntil : (now - entry.firstAt > LOGIN_WINDOW_MS && loginAttempts.delete(key), 0) : 0;
}
function registerLoginFailure(key) {
  let now = Date.now(), entry = loginAttempts.get(key);
  return !entry || now - entry.firstAt > LOGIN_WINDOW_MS ? (loginAttempts.set(key, { count: 1, firstAt: now, lockedUntil: 0 }), 0) : (entry.count += 1, entry.count >= LOGIN_MAX_ATTEMPTS ? (entry.lockedUntil = now + LOGIN_LOCK_MS, entry.count = 0, entry.firstAt = now, entry.lockedUntil) : 0);
}
function clearLoginFailures(key) {
  loginAttempts.delete(key);
}
function activeUsersFromState() {
  let disk = readRealtimeDisk();
  return parseRealtimeJson(
    disk.keys.pk_detail_users_v1,
    []
  ).filter((user) => !!user && typeof user == "object" && user.active !== !1);
}
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}
function stripPublicSecrets(portalConfigJson) {
  if (typeof portalConfigJson != "string") return portalConfigJson;
  try {
    let parsed = JSON.parse(portalConfigJson);
    return delete parsed.kioskPin, JSON.stringify(parsed);
  } catch {
    return;
  }
}
function sanitizeBookingText(value, maxLength) {
  return typeof value != "string" ? "" : value.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, maxLength);
}
var sseConnections = /* @__PURE__ */ new Set(), realtimeCache = null, brandRegistryCache = null;
function ensureStorageDirs() {
  if (!isRedisEnabled())
    try {
      fs.mkdirSync(ASSETS_DIR, { recursive: !0 });
    } catch {
    }
}
async function readRegistry() {
  if (isRedisEnabled()) {
    if (brandRegistryCache) return brandRegistryCache;
    let remote = await readBrandRegistryRemote();
    if (remote && typeof remote == "object")
      return brandRegistryCache = remote, remote;
    let empty = {
      activeLogo: null,
      version: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      history: [],
      audit: []
    };
    return await writeRegistryAtomic(empty), empty;
  }
  if (ensureStorageDirs(), !fs.existsSync(REGISTRY_PATH)) {
    let initial = {
      activeLogo: null,
      version: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      history: [],
      audit: []
    };
    return await writeRegistryAtomic(initial), initial;
  }
  try {
    let raw = fs.readFileSync(REGISTRY_PATH, "utf8"), parsed = JSON.parse(raw);
    return {
      activeLogo: parsed.activeLogo ?? null,
      version: typeof parsed.version == "number" && parsed.version >= 1 ? parsed.version : 1,
      updatedAt: typeof parsed.updatedAt == "string" ? parsed.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
      history: Array.isArray(parsed.history) ? parsed.history : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : []
    };
  } catch {
    return {
      activeLogo: null,
      version: 1,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      history: [],
      audit: []
    };
  }
}
async function writeRegistryAtomic(next) {
  if (brandRegistryCache = next, isRedisEnabled()) {
    await writeBrandRegistryRemote(next);
    return;
  }
  ensureStorageDirs();
  let tmpPath = `${REGISTRY_PATH}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), "utf8"), fs.renameSync(tmpPath, REGISTRY_PATH);
}
function sanitizeFileName(raw) {
  return (raw.split(/[/\\]/).pop() || "logo").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 80) || "logo";
}
function resolveFormatAndExt(fileName, mimeType) {
  let lowerMime = (mimeType || "").toLowerCase().trim(), ext = (fileName.split(".").pop() || "").toLowerCase().trim();
  return lowerMime === "image/png" || !lowerMime && ext === "png" ? { format: "PNG", mimeType: "image/png", ext: "png" } : lowerMime === "image/jpeg" || lowerMime === "image/jpg" || ext === "jpg" || ext === "jpeg" ? {
    format: ext === "jpg" ? "JPG" : "JPEG",
    mimeType: "image/jpeg",
    ext: "jpg"
  } : lowerMime === "image/webp" || !lowerMime && ext === "webp" ? { format: "WEBP", mimeType: "image/webp", ext: "webp" } : lowerMime === "image/svg+xml" || !lowerMime && ext === "svg" ? { format: "SVG", mimeType: "image/svg+xml", ext: "svg" } : null;
}
function hasValidMagicBytes(buf, mimeType) {
  return buf.length < 12 ? !1 : mimeType === "image/png" ? buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10 : mimeType === "image/jpeg" ? buf[0] === 255 && buf[1] === 216 && buf[2] === 255 : mimeType === "image/webp" ? buf[0] === 82 && buf[1] === 73 && buf[2] === 70 && buf[3] === 70 && buf[8] === 87 && buf[9] === 69 && buf[10] === 66 && buf[11] === 80 : !1;
}
var FORBIDDEN_SVG_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "applet",
  "frame",
  "frameset",
  "meta",
  "link",
  "base",
  "audio",
  "video",
  "portal"
];
function sanitizeSvgBuffer(buf) {
  let raw = buf.toString("utf8");
  if (!raw || raw.includes("\0"))
    return { ok: !1, error: "Arquivo SVG inv\xE1lido ou corrompido." };
  let cleaned = raw.replace(/^\uFEFF/, "").replace(/<\?[\s\S]*?\?>/gi, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!ENTITY[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, "").trim(), svgStart = cleaned.search(/<svg[\s>]/i), svgEnd = cleaned.toLowerCase().lastIndexOf("</svg>");
  if (svgStart === -1 || svgEnd === -1 || svgEnd <= svgStart)
    return { ok: !1, error: "Estrutura SVG inv\xE1lida." };
  cleaned = cleaned.slice(svgStart, svgEnd + 6);
  for (let tag of FORBIDDEN_SVG_TAGS) {
    let pairedRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), selfRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    cleaned = cleaned.replace(pairedRe, "").replace(selfRe, "");
  }
  return cleaned = cleaned.replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*"[^"]*"/gi, "").replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*'[^']*'/gi, "").replace(/\s+on[a-zA-Z0-9_-]+\s*=\s*[^\s>]+/gi, ""), cleaned = cleaned.replace(
    /\s+((?:xlink:)?href|src|action|formaction)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_full, attr, _q, dq, sq) => {
      let val = (dq ?? sq ?? "").trim();
      return !val || val.startsWith("#") ? ` ${attr}="${val}"` : /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(val) ? ` ${attr}="${val}"` : "";
    }
  ), cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, cssBody) => `<style>${cssBody.replace(/@import[^;]*;?/gi, "").replace(/expression\s*\([^)]*\)/gi, "").replace(/javascript\s*:/gi, "").replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, "none")}</style>`), cleaned = cleaned.replace(/\s+style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, dq, sq) => ` style="${(dq ?? sq ?? "").replace(/expression\s*\([^)]*\)/gi, "").replace(/javascript\s*:/gi, "").replace(/url\s*\(\s*['"]?(?!#)[^)]*\)/gi, "none")}"`), cleaned.replace(/^<svg\b[^>]*>/i, "").replace(/<\/svg>$/i, "").trim() ? { ok: !0, buffer: Buffer.from(cleaned, "utf8") } : { ok: !1, error: "SVG rejeitado pela pol\xEDtica de seguran\xE7a." };
}
function mimeFromAssetFilename(filename) {
  let lower = filename.toLowerCase();
  return lower.endsWith(".png") ? "image/png" : lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : lower.endsWith(".webp") ? "image/webp" : lower.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
}
function parseRealtimeJson(raw, fallback) {
  if (typeof raw != "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function readRealtimeDisk() {
  if (realtimeCache) return realtimeCache;
  try {
    if (fs.existsSync(REALTIME_STATE_PATH)) {
      let parsed = JSON.parse(fs.readFileSync(REALTIME_STATE_PATH, "utf8"));
      return realtimeCache = {
        revision: Number(parsed.revision) || 0,
        updatedAt: typeof parsed.updatedAt == "string" ? parsed.updatedAt : (/* @__PURE__ */ new Date()).toISOString(),
        keys: parsed.keys && typeof parsed.keys == "object" ? parsed.keys : {}
      }, realtimeCache;
    }
  } catch {
  }
  return realtimeCache = { revision: 0, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), keys: {} }, realtimeCache;
}
function persistRealtimeDisk(disk) {
  if (isRedisEnabled()) return;
  fs.mkdirSync(REALTIME_DIR, { recursive: !0 });
  let tmpPath = `${REALTIME_STATE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(disk), "utf8"), fs.renameSync(tmpPath, REALTIME_STATE_PATH);
}
function sanitizeRealtimeChanges(raw) {
  if (!raw || typeof raw != "object") return {};
  let entries = Object.entries(raw).filter(
    ([key, value]) => key.startsWith("pk_detail_") && typeof value == "string" && value.length <= 6e6
  ).slice(0, REALTIME_MAX_KEYS_PER_REQUEST);
  return Object.fromEntries(entries);
}
function broadcastRealtime(changes, sourceClientId) {
  if (Object.keys(changes).length === 0) return;
  let payload = `data: ${JSON.stringify({
    type: "state",
    revision: readRealtimeDisk().revision,
    clientId: sourceClientId,
    changes
  })}

`;
  for (let connection of sseConnections)
    try {
      connection.res.write(payload);
    } catch {
      sseConnections.delete(connection);
    }
}
async function applyRealtimeChanges(changes, sourceClientId) {
  let disk = readRealtimeDisk();
  if (Object.assign(disk.keys, changes), disk.revision += 1, disk.updatedAt = (/* @__PURE__ */ new Date()).toISOString(), isRedisEnabled()) {
    let remoteRevision = await persistStateChanges(changes);
    remoteRevision !== null && (disk.revision = remoteRevision);
  } else
    persistRealtimeDisk(disk);
  return broadcastRealtime(changes, sourceClientId), disk.revision;
}
var PUSH_DIR = path.resolve(process.cwd(), "storage", "push"), PUSH_VAPID_PATH = path.join(PUSH_DIR, "vapid.json"), PUSH_SUBSCRIPTIONS_PATH = path.join(PUSH_DIR, "subscriptions.json"), PUSH_SENT_PATH = path.join(PUSH_DIR, "sent.json"), PUSH_SUBJECT = process.env.PK_PUSH_SUBJECT || "mailto:contato@pkdetail.com.br", PUSH_LEAD_MINUTES = (() => {
  let raw = Number(process.env.PK_PUSH_LEAD_MINUTES);
  return Number.isFinite(raw) ? Math.max(5, Math.min(1440, Math.round(raw))) : 60;
})(), PUSH_MAX_SUBSCRIPTIONS = 200, PUSH_TICK_MS = 6e4, PUSH_RETRY_MS = 5 * 6e4, APPOINTMENTS_STATE_KEY = "pk_detail_appointments_v1", PUSH_ENDPOINT_HOSTS = /* @__PURE__ */ new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com"
]), pushSubscriptionsCache = null, pushSentCache = null, pushVapidCache = null, pushTickRunning = !1, pushAttempts = /* @__PURE__ */ new Map();
function writePushJson(filePath, data) {
  fs.mkdirSync(PUSH_DIR, { recursive: !0 });
  let tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), "utf8"), fs.renameSync(tmpPath, filePath);
}
async function ensurePushVapid() {
  if (pushVapidCache) return pushVapidCache;
  let envPublic = process.env.VAPID_PUBLIC_KEY || process.env.PK_VAPID_PUBLIC_KEY, envPrivate = process.env.VAPID_PRIVATE_KEY || process.env.PK_VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate)
    return pushVapidCache = { publicKey: envPublic, privateKey: envPrivate }, pushVapidCache;
  if (isRedisEnabled()) {
    let remote = await readVapidRemote();
    if (remote)
      return pushVapidCache = remote, pushVapidCache;
    let keys = webpush.generateVAPIDKeys();
    return pushVapidCache = { publicKey: keys.publicKey, privateKey: keys.privateKey }, await writeVapidRemote(pushVapidCache), pushVapidCache;
  }
  try {
    if (fs.existsSync(PUSH_VAPID_PATH)) {
      let parsed = JSON.parse(fs.readFileSync(PUSH_VAPID_PATH, "utf8"));
      typeof parsed.publicKey == "string" && typeof parsed.privateKey == "string" && (pushVapidCache = { publicKey: parsed.publicKey, privateKey: parsed.privateKey });
    }
  } catch {
  }
  if (!pushVapidCache) {
    let keys = webpush.generateVAPIDKeys();
    pushVapidCache = { publicKey: keys.publicKey, privateKey: keys.privateKey };
    try {
      writePushJson(PUSH_VAPID_PATH, pushVapidCache), fs.chmodSync(PUSH_VAPID_PATH, 384);
    } catch {
    }
  }
  return pushVapidCache;
}
function readPushSubscriptions() {
  if (pushSubscriptionsCache) return pushSubscriptionsCache;
  try {
    if (fs.existsSync(PUSH_SUBSCRIPTIONS_PATH)) {
      let parsed = JSON.parse(fs.readFileSync(PUSH_SUBSCRIPTIONS_PATH, "utf8"));
      return pushSubscriptionsCache = {
        version: 1,
        subscriptions: (Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []).filter(
          (item) => item && typeof item.endpoint == "string" && typeof item.keys?.p256dh == "string" && typeof item.keys?.auth == "string"
        )
      }, pushSubscriptionsCache;
    }
  } catch {
  }
  return pushSubscriptionsCache = { version: 1, subscriptions: [] }, pushSubscriptionsCache;
}
async function persistPushSubscriptions(disk) {
  if (pushSubscriptionsCache = disk, isRedisEnabled()) {
    await writePushSubsRemote(disk);
    return;
  }
  try {
    writePushJson(PUSH_SUBSCRIPTIONS_PATH, disk);
  } catch {
  }
}
function readPushSent() {
  if (pushSentCache) return pushSentCache;
  try {
    if (fs.existsSync(PUSH_SENT_PATH)) {
      let parsed = JSON.parse(fs.readFileSync(PUSH_SENT_PATH, "utf8"));
      return pushSentCache = {
        version: 1,
        sent: parsed.sent && typeof parsed.sent == "object" ? parsed.sent : {}
      }, pushSentCache;
    }
  } catch {
  }
  return pushSentCache = { version: 1, sent: {} }, pushSentCache;
}
async function persistPushSent(disk) {
  let cutoff = Date.now() - 2592e6, entries = Object.entries(disk.sent).filter(([, iso]) => {
    let ms = Date.parse(iso);
    return Number.isFinite(ms) && ms >= cutoff;
  }).sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).slice(0, 500), pruned = { version: 1, sent: Object.fromEntries(entries) };
  if (pushSentCache = pruned, isRedisEnabled()) {
    await writePushSentRemote(pruned);
    return;
  }
  try {
    writePushJson(PUSH_SENT_PATH, pruned);
  } catch {
  }
}
async function primeRequestCaches() {
  if (!isRedisEnabled()) return;
  let state = await hydrateState();
  if (state) {
    realtimeCache = state;
    let bootstrapEmail = (process.env.PK_BOOTSTRAP_ADMIN_EMAIL || "kauassnt@gmail.com").trim().toLowerCase();
    if (bootstrapEmail && !state.keys.pk_detail_users_v1) {
      let admin2 = {
        id: "usr_1",
        name: (process.env.PK_BOOTSTRAP_ADMIN_NAME || "Administrador").slice(0, 80),
        email: bootstrapEmail,
        phone: "",
        role: "admin",
        active: !0
      }, seeded = { pk_detail_users_v1: JSON.stringify([admin2]) };
      await persistStateChanges(seeded), realtimeCache = { ...state, keys: { ...state.keys, ...seeded } };
    }
  }
  let admin = await readAdminCredentialRemote();
  credentialCache = admin && admin.algorithm === "scrypt" && typeof admin.salt == "string" && typeof admin.hash == "string" && typeof admin.pinFingerprint == "string" ? admin : null;
  let users = await readUserCredentialsRemote();
  userCredentialsCache = {
    version: 1,
    users: users && users.users ? users.users : {}
  };
  let subs = await readPushSubsRemote();
  subs && Array.isArray(subs.subscriptions) && (pushSubscriptionsCache = { version: 1, subscriptions: subs.subscriptions });
  let sent = await readPushSentRemote();
  sent && sent.sent && typeof sent.sent == "object" && (pushSentCache = { version: 1, sent: sent.sent });
  let vapid = await readVapidRemote();
  vapid && (pushVapidCache = vapid);
  let brand = await readBrandRegistryRemote();
  brand && typeof brand == "object" && (brandRegistryCache = brand);
}
function isAllowedPushEndpoint(value) {
  try {
    let url = new URL(value);
    if (url.protocol !== "https:") return !1;
    let host = url.hostname.toLowerCase();
    return PUSH_ENDPOINT_HOSTS.has(host) || host.endsWith(".notify.windows.com") || host.endsWith(".push.apple.com");
  } catch {
    return !1;
  }
}
function sanitizePushSubscription(raw) {
  if (!raw || typeof raw != "object") return null;
  let candidate = raw, endpoint = typeof candidate.endpoint == "string" ? candidate.endpoint.trim() : "", p256dh = typeof candidate.keys?.p256dh == "string" ? candidate.keys.p256dh.trim() : "", auth = typeof candidate.keys?.auth == "string" ? candidate.keys.auth.trim() : "";
  return !isAllowedPushEndpoint(endpoint) || !/^[A-Za-z0-9_-]{16,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,200}$/.test(auth) ? null : { endpoint, keys: { p256dh, auth } };
}
async function sendPushPayload(record, payload) {
  let vapid = await ensurePushVapid();
  try {
    return await webpush.sendNotification(
      { endpoint: record.endpoint, keys: record.keys },
      JSON.stringify(payload),
      {
        TTL: 3600,
        urgency: "high",
        vapidDetails: { subject: PUSH_SUBJECT, ...vapid }
      }
    ), { ok: !0, statusCode: 200 };
  } catch (error) {
    return { ok: !1, statusCode: Number(error?.statusCode) || 0 };
  }
}
function appointmentStartMs(date, startTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return null;
  let ms = (/* @__PURE__ */ new Date(`${date}T${startTime}:00`)).getTime();
  return Number.isFinite(ms) ? ms : null;
}
function buildReminderPayload(appointment, startTime, minutes) {
  let clientName = String(appointment.clientName || "Cliente").slice(0, 80), model = String(appointment.motorcycleModel || "").slice(0, 40), plate = String(appointment.motorcyclePlate || "").slice(0, 12), vehicle = [model, plate].filter(Boolean).join(" \xB7 ");
  return {
    title: `Agendamento em ${minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} hora${minutes === 60 ? "" : "s"}` : `${minutes} minuto${minutes === 1 ? "" : "s"}`}`,
    body: [`${startTime} \xB7 ${clientName}`, vehicle].filter(Boolean).join(" \u2014 "),
    url: "/agenda",
    tag: `pk-agendamento-${String(appointment.id || startTime)}`,
    ts: Date.now()
  };
}
async function runPushReminderTick() {
  if (!pushTickRunning) {
    pushTickRunning = !0;
    try {
      let disk = readPushSubscriptions();
      if (disk.subscriptions.length === 0) return;
      let state = readRealtimeDisk(), appointments = parseRealtimeJson(state.keys[APPOINTMENTS_STATE_KEY], []);
      if (!Array.isArray(appointments) || appointments.length === 0) return;
      let now = Date.now(), leadMs = PUSH_LEAD_MINUTES * 6e4, sentDisk = readPushSent(), staleEndpoints = /* @__PURE__ */ new Set(), sentChanged = !1;
      for (let raw of appointments) {
        if (!raw || typeof raw != "object") continue;
        let appointment = raw, status = String(appointment.status || "");
        if (status === "cancelado" || status === "nao_compareceu" || status === "concluido") continue;
        let date = String(appointment.date || ""), startTime = String(appointment.startTime || ""), startMs = appointmentStartMs(date, startTime);
        if (startMs === null) continue;
        let diff = startMs - now;
        if (diff < 0 || diff > leadMs) continue;
        let dedupe = `${String(appointment.id || "") || `${date}T${startTime}`}|${date}T${startTime}|${PUSH_LEAD_MINUTES}`;
        if (sentDisk.sent[dedupe]) continue;
        let lastAttempt = pushAttempts.get(dedupe) || 0;
        if (now - lastAttempt < PUSH_RETRY_MS) continue;
        let minutes = Math.max(1, Math.round(diff / 6e4)), payload = buildReminderPayload(appointment, startTime, minutes), targets = disk.subscriptions.filter((item) => !staleEndpoints.has(item.endpoint));
        if (targets.length === 0) break;
        let delivered = 0;
        for (let target of targets) {
          let result = await sendPushPayload(target, payload);
          result.ok ? delivered += 1 : result.statusCode === 404 || result.statusCode === 410 ? staleEndpoints.add(target.endpoint) : console.warn(`[push] falha ao entregar ${dedupe}: status ${result.statusCode || "desconhecido"}`);
        }
        pushAttempts.set(dedupe, now), delivered > 0 && (sentDisk.sent[dedupe] = (/* @__PURE__ */ new Date()).toISOString(), sentChanged = !0, console.log(`[push] lembrete enviado (${minutes} min): ${payload.body} \u2192 ${delivered} dispositivo(s)`));
      }
      staleEndpoints.size > 0 && (await persistPushSubscriptions({
        version: 1,
        subscriptions: disk.subscriptions.filter((item) => !staleEndpoints.has(item.endpoint))
      }), console.log(`[push] ${staleEndpoints.size} inscri\xE7\xE3o(\xF5es) expirada(s) removida(s)`)), sentChanged && await persistPushSent(sentDisk);
    } finally {
      pushTickRunning = !1;
    }
  }
}
function startPushScheduler() {
  let tick = () => {
    runPushReminderTick().catch((error) => {
      console.warn("[push] falha na verifica\xE7\xE3o de agendamentos:", error?.message || error);
    });
  }, initial = setTimeout(tick, 15e3);
  typeof initial.unref == "function" && initial.unref();
  let timer = setInterval(tick, PUSH_TICK_MS);
  typeof timer.unref == "function" && timer.unref();
}
var SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
function requestIsSecure(req) {
  return req.secure ? !0 : String(req.header("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase() === "https";
}
function buildContentSecurityPolicy(isDev) {
  let scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'", connectSrc = isDev ? "'self' ws: wss: https://fonts.googleapis.com https://fonts.gstatic.com" : "'self' https://fonts.googleapis.com https://fonts.gstatic.com";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    isDev ? "" : "upgrade-insecure-requests"
  ].filter(Boolean).join("; ");
}
function createRateLimiter(options) {
  let buckets = /* @__PURE__ */ new Map(), sweeper = setInterval(() => {
    let now = Date.now();
    for (let [key, bucket] of buckets)
      bucket.resetAt <= now && buckets.delete(key);
  }, Math.max(options.windowMs, 3e4));
  return typeof sweeper.unref == "function" && sweeper.unref(), (req, res, next) => {
    let now = Date.now(), key = req.ip || req.socket.remoteAddress || "unknown", current = buckets.get(key), bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs };
    bucket.count += 1, buckets.set(key, bucket);
    let remaining = Math.max(0, options.max - bucket.count);
    if (res.setHeader("RateLimit-Limit", String(options.max)), res.setHeader("RateLimit-Remaining", String(remaining)), res.setHeader("RateLimit-Reset", String(Math.ceil((bucket.resetAt - now) / 1e3))), bucket.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1e3))), res.status(429).json({ error: options.message });
      return;
    }
    next();
  };
}
async function startServer() {
  ensureStorageDirs();
  let app = express();
  app.disable("x-powered-by"), app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => String(res.getHeader("Content-Type") || "").includes("text/event-stream") ? !1 : compression.filter(req, res)
    })
  );
  let sessionSweeper = setInterval(() => {
    pruneSessions();
  }, 10 * 6e4);
  typeof sessionSweeper.unref == "function" && sessionSweeper.unref(), IS_PRODUCTION && app.set("trust proxy", 1), app.use((_req, _res, next) => {
    primeRequestCaches().then(
      () => next(),
      () => next()
    );
  }), IS_PRODUCTION && !ALLOW_HTTP && app.use((req, res, next) => {
    if (requestIsSecure(req) || req.path === "/api/health") {
      next();
      return;
    }
    res.redirect(308, `https://${req.header("host")}${req.originalUrl}`);
  });
  let csp = buildContentSecurityPolicy(!IS_PRODUCTION);
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", csp), res.setHeader("X-Content-Type-Options", "nosniff"), res.setHeader("X-Frame-Options", "DENY"), res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"), res.setHeader("X-Permitted-Cross-Domain-Policies", "none"), res.setHeader("Cross-Origin-Opener-Policy", "same-origin"), res.setHeader("Cross-Origin-Resource-Policy", "same-origin"), res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=()"
    ), requestIsSecure(req) && res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains"), next();
  }), app.use("/api", (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    let origin = req.header("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "";
      }
      let requestHost = String(req.header("host") || "");
      if (!originHost || originHost !== requestHost) {
        res.status(403).json({ error: "Origem da requisi\xE7\xE3o n\xE3o autorizada." });
        return;
      }
    }
    if (req.method !== "DELETE" && !req.is("application/json")) {
      res.status(415).json({ error: "Formato de requisi\xE7\xE3o n\xE3o suportado. Envie application/json." });
      return;
    }
    next();
  });
  let apiLimiter = createRateLimiter({
    windowMs: 6e4,
    // IPs compartilhados (NAT/escritório) podem ter vários operadores atrás do mesmo endereço.
    max: 600,
    message: "Muitas requisi\xE7\xF5es. Aguarde um instante e tente novamente."
  }), writeLimiter = createRateLimiter({
    windowMs: 6e4,
    // Sincronização em tempo real envia vários lotes por minuto em uso intenso.
    max: 120,
    message: "Limite de opera\xE7\xF5es de escrita atingido. Aguarde antes de tentar novamente."
  });
  app.use("/api", apiLimiter), app.use("/api", (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    writeLimiter(req, res, next);
  });
  let jsonBodyParser = express.json({ limit: "8mb" });
  app.use((req, res, next) => {
    if (req.body !== void 0 && req.body !== null && typeof req.body == "object") {
      req._body = !0, next();
      return;
    }
    jsonBodyParser(req, res, next);
  }), app.get(["/sw.js", "/manifest.json", "/offline.html"], (_req, res, next) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate"), res.setHeader("Service-Worker-Allowed", "/"), next();
  }), app.get("/api/health", (_req, res) => {
    res.json({ ok: !0, service: "pk-detail-brand-storage" });
  }), app.use("/api/auth", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"), next();
  });
  let authLimiter = createRateLimiter({
    windowMs: 6e4,
    max: 30,
    message: "Muitas tentativas de autentica\xE7\xE3o. Aguarde antes de tentar novamente."
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    if (Number(req.header("content-length") || 0) > MAX_AUTH_BODY_BYTES) {
      res.status(413).json({ error: "Requisi\xE7\xE3o de autentica\xE7\xE3o muito grande." });
      return;
    }
    let body = req.body || {}, email = typeof body.email == "string" ? body.email.trim().toLowerCase().slice(0, 160) : "", password = typeof body.password == "string" ? body.password.slice(0, 128) : "";
    if (!email || !password) {
      res.status(400).json({ error: "Informe e-mail e senha." });
      return;
    }
    let key = loginRateKey(req, email), lockedUntil = loginIsLocked(key);
    if (lockedUntil > Date.now()) {
      let retrySeconds = Math.ceil((lockedUntil - Date.now()) / 1e3);
      res.setHeader("Retry-After", String(retrySeconds)), secureLog("auth.login_locked", { email: maskEmail(email), ip: req.ip }), res.status(429).json({
        error: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
      });
      return;
    }
    let user = activeUsersFromState().find(
      (candidate) => String(candidate.email || "").trim().toLowerCase() === email
    ), ownCredential = user ? readUserCredentials().users[String(user.id)] : void 0, passwordOk = user && ownCredential ? verifyUserCredential(String(user.id), password) : verifyPin(password, await ensureCredentialSynced());
    if (!user || !passwordOk) {
      let lock = registerLoginFailure(key);
      secureLog("auth.login_failed", {
        email: maskEmail(email),
        userExists: !!user,
        ip: req.ip,
        locked: lock > 0
      }), res.status(401).json({ error: "E-mail ou senha inv\xE1lidos." });
      return;
    }
    clearLoginFailures(key), pruneSessions();
    let sid = crypto3.randomBytes(32).toString("base64url"), now = Date.now(), session = {
      id: sid,
      userId: String(user.id || ""),
      userName: String(user.name || ""),
      userRole: String(user.role || "operacional"),
      userEmail: email,
      createdAt: now,
      lastSeenAt: now,
      ip: req.ip || "",
      userAgent: String(req.header("user-agent") || "").slice(0, 200)
    };
    await persistSession(session);
    let previousSid = parseCookieHeader(req.header("cookie"))[SESSION_COOKIE];
    previousSid && previousSid !== sid && await destroySession(previousSid), res.setHeader("Set-Cookie", sessionCookie(sid, req)), secureLog("auth.login_success", {
      userId: session.userId,
      role: session.userRole,
      email: maskEmail(email),
      ip: req.ip,
      ownPassword: !!ownCredential
    }), res.json({ ok: !0, user: publicUser(user), hasOwnPassword: !!ownCredential });
  }), app.get("/api/auth/session", async (req, res) => {
    let session = await getSession(req);
    if (!session) {
      res.json({ authenticated: !1 });
      return;
    }
    let user = activeUsersFromState().find((candidate) => candidate.id === session.userId);
    if (!user || String(user.role || "") !== session.userRole) {
      await destroySession(session.id), res.setHeader("Set-Cookie", clearSessionCookie(req)), res.json({ authenticated: !1 });
      return;
    }
    res.json({ authenticated: !0, user: publicUser(user) });
  }), app.post("/api/auth/logout", async (req, res) => {
    let sid = parseCookieHeader(req.header("cookie"))[SESSION_COOKIE];
    sid && (await destroySession(sid), secureLog("auth.logout", { ip: req.ip })), res.setHeader("Set-Cookie", clearSessionCookie(req)), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0 });
  }), app.post("/api/auth/verify-pin", authLimiter, requireAuth, async (req, res) => {
    let body = req.body || {}, pin = typeof body.pin == "string" ? body.pin.trim().slice(0, 32) : "";
    if (!pin) {
      res.status(400).json({ error: "Informe o PIN administrativo." });
      return;
    }
    let key = loginRateKey(req, `pin:${req.pkSession?.userId || "anon"}`);
    if (loginIsLocked(key) > Date.now()) {
      res.status(429).json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." });
      return;
    }
    if (!verifyPin(pin, await ensureCredentialSynced())) {
      registerLoginFailure(key), secureLog("auth.pin_failed", { ip: req.ip }), res.status(401).json({ error: "PIN incorreto." });
      return;
    }
    clearLoginFailures(key), res.json({ ok: !0 });
  }), app.get("/api/admin/users/credentials", requireAuth, requireRole(["admin"]), (_req, res) => {
    let disk = readUserCredentials(), users = allUsersFromState().map((user) => {
      let record = disk.users[String(user.id)];
      return {
        userId: String(user.id),
        passwordSet: !!record,
        updatedAt: record?.updatedAt || null
      };
    });
    res.setHeader("Cache-Control", "no-store"), res.json({ credentials: users });
  }), app.put(
    "/api/admin/users/:userId/password",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      let userId = String(req.params.userId || "").slice(0, 64);
      if (!allUsersFromState().find((user) => String(user.id) === userId)) {
        res.status(404).json({ error: "Funcion\xE1rio n\xE3o encontrado." });
        return;
      }
      let body = req.body || {}, password = typeof body.password == "string" ? body.password : "", policyError = passwordPolicyError(password);
      if (policyError) {
        res.status(400).json({ error: policyError });
        return;
      }
      await setUserCredential(userId, password);
      let session = req.pkSession;
      secureLog("auth.employee_password_set", {
        adminId: session.userId,
        targetId: userId,
        ip: req.ip
      }), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0, userId, passwordSet: !0 });
    }
  ), app.delete(
    "/api/admin/users/:userId/password",
    requireAuth,
    requireRole(["admin"]),
    async (req, res) => {
      let userId = String(req.params.userId || "").slice(0, 64), removed = await removeUserCredential(userId), session = req.pkSession;
      secureLog("auth.employee_password_cleared", {
        adminId: session.userId,
        targetId: userId,
        existed: removed,
        ip: req.ip
      }), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0, userId, passwordSet: !1 });
    }
  ), app.post("/api/auth/change-password", authLimiter, requireAuth, async (req, res) => {
    let session = req.pkSession, body = req.body || {}, currentPassword = typeof body.currentPassword == "string" ? body.currentPassword : "", newPassword = typeof body.newPassword == "string" ? body.newPassword : "";
    if (!(!!readUserCredentials().users[session.userId] ? verifyUserCredential(session.userId, currentPassword) : verifyPin(currentPassword, await ensureCredentialSynced()))) {
      secureLog("auth.password_change_failed", { userId: session.userId, ip: req.ip }), res.status(401).json({ error: "Senha atual incorreta." });
      return;
    }
    let policyError = passwordPolicyError(newPassword);
    if (policyError) {
      res.status(400).json({ error: policyError });
      return;
    }
    await setUserCredential(session.userId, newPassword), secureLog("auth.password_changed", { userId: session.userId, ip: req.ip }), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0 });
  }), app.get("/api/state", requireAuth, (_req, res) => {
    let disk = readRealtimeDisk();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"), res.json({ revision: disk.revision, updatedAt: disk.updatedAt, keys: disk.keys });
  }), app.post("/api/state", requireAuth, async (req, res) => {
    let body = req.body || {}, changes = sanitizeRealtimeChanges(body.changes);
    if (Object.keys(changes).length === 0) {
      res.status(400).json({ error: "Nenhuma altera\xE7\xE3o v\xE1lida recebida." });
      return;
    }
    let revision = await applyRealtimeChanges(changes, String(body.clientId || "unknown"));
    res.json({ ok: !0, revision });
  });
  let pushLimiter = createRateLimiter({
    windowMs: 6e4,
    max: 30,
    message: "Muitas atualiza\xE7\xF5es de notifica\xE7\xE3o. Aguarde um instante."
  }), pushTestLimiter = createRateLimiter({
    windowMs: 10 * 6e4,
    max: 5,
    message: "Limite de notifica\xE7\xF5es de teste atingido. Aguarde alguns minutos."
  });
  app.get("/api/push/status", requireAuth, async (req, res) => {
    let session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Sess\xE3o inv\xE1lida." });
      return;
    }
    let vapid = await ensurePushVapid(), disk = readPushSubscriptions();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"), res.json({
      enabled: !0,
      publicKey: vapid.publicKey,
      leadMinutes: PUSH_LEAD_MINUTES,
      subscriptions: disk.subscriptions.length,
      mySubscriptions: disk.subscriptions.filter((item) => item.userId === session.userId).length
    });
  }), app.post("/api/push/subscribe", requireAuth, pushLimiter, async (req, res) => {
    let session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Sess\xE3o inv\xE1lida." });
      return;
    }
    let body = req.body || {}, parsed = sanitizePushSubscription(body.subscription);
    if (!parsed) {
      res.status(400).json({ error: "Inscri\xE7\xE3o de notifica\xE7\xE3o inv\xE1lida." });
      return;
    }
    let disk = readPushSubscriptions(), now = (/* @__PURE__ */ new Date()).toISOString(), existing = disk.subscriptions.find((item) => item.endpoint === parsed.endpoint);
    existing ? (existing.keys = parsed.keys, existing.userId = session.userId, existing.userName = session.userName, existing.userAgent = String(req.header("user-agent") || "").slice(0, 200), existing.updatedAt = now) : (disk.subscriptions.length >= PUSH_MAX_SUBSCRIPTIONS && disk.subscriptions.shift(), disk.subscriptions.unshift({
      endpoint: parsed.endpoint,
      keys: parsed.keys,
      userId: session.userId,
      userName: session.userName,
      userAgent: String(req.header("user-agent") || "").slice(0, 200),
      createdAt: now,
      updatedAt: now
    })), await persistPushSubscriptions(disk), secureLog("push.subscribed", { userId: session.userId, ip: req.ip, total: disk.subscriptions.length }), res.setHeader("Cache-Control", "no-store"), res.json({
      ok: !0,
      subscriptions: disk.subscriptions.length,
      mySubscriptions: disk.subscriptions.filter((item) => item.userId === session.userId).length
    });
  }), app.post("/api/push/unsubscribe", requireAuth, pushLimiter, async (req, res) => {
    let session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Sess\xE3o inv\xE1lida." });
      return;
    }
    let body = req.body || {}, endpoint = typeof body.endpoint == "string" ? body.endpoint.trim() : "";
    if (!endpoint) {
      res.status(400).json({ error: "Inscri\xE7\xE3o n\xE3o informada." });
      return;
    }
    let disk = readPushSubscriptions(), before = disk.subscriptions.length;
    disk.subscriptions = disk.subscriptions.filter(
      (item) => !(item.endpoint === endpoint && item.userId === session.userId)
    ), disk.subscriptions.length !== before && await persistPushSubscriptions(disk), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0, subscriptions: disk.subscriptions.length });
  }), app.post("/api/push/test", requireAuth, pushTestLimiter, async (req, res) => {
    let session = await getSession(req);
    if (!session) {
      res.status(401).json({ error: "Sess\xE3o inv\xE1lida." });
      return;
    }
    let disk = readPushSubscriptions(), mine = disk.subscriptions.filter((item) => item.userId === session.userId);
    if (mine.length === 0) {
      res.status(400).json({ error: "Ative as notifica\xE7\xF5es neste dispositivo primeiro." });
      return;
    }
    let payload = {
      title: "PK Detail \u2014 notifica\xE7\xF5es ativas",
      body: `Tudo certo, ${session.userName}. Os lembretes de agendamento v\xE3o chegar aqui.`,
      url: "/agenda",
      tag: "pk-teste",
      ts: Date.now()
    }, sent = 0, stale = /* @__PURE__ */ new Set();
    for (let target of mine) {
      let result = await sendPushPayload(target, payload);
      result.ok ? sent += 1 : result.statusCode === 404 || result.statusCode === 410 ? stale.add(target.endpoint) : console.warn(`[push] teste falhou: status ${result.statusCode || "desconhecido"}`);
    }
    stale.size > 0 && await persistPushSubscriptions({
      version: 1,
      subscriptions: disk.subscriptions.filter((item) => !stale.has(item.endpoint))
    }), res.setHeader("Cache-Control", "no-store"), res.json({ ok: sent > 0, sent, failed: mine.length - sent });
  }), process.env.VERCEL !== "1" && startPushScheduler(), app.get("/api/cron/push", async (req, res) => {
    let secret = process.env.CRON_SECRET || "", provided = String(req.header("authorization") || "").replace(/^Bearer\s+/i, "").trim() || String(req.query.key || "");
    if (!secret || provided !== secret) {
      res.status(401).json({ error: "N\xE3o autorizado." });
      return;
    }
    await primeRequestCaches(), await runPushReminderTick(), res.setHeader("Cache-Control", "no-store"), res.json({ ok: !0, at: (/* @__PURE__ */ new Date()).toISOString() });
  }), app.get("/api/public/snapshot", (_req, res) => {
    let disk = readRealtimeDisk(), keys = {};
    for (let key of PUBLIC_SNAPSHOT_KEYS)
      typeof disk.keys[key] == "string" && (keys[key] = disk.keys[key]);
    let sanitizedPortal = stripPublicSecrets(keys.pk_detail_portal_config_v1);
    sanitizedPortal ? keys.pk_detail_portal_config_v1 = sanitizedPortal : delete keys.pk_detail_portal_config_v1, res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate"), res.json({ revision: disk.revision, keys });
  });
  let bookingLimiter = createRateLimiter({
    windowMs: 10 * 6e4,
    max: 15,
    message: "Muitas solicita\xE7\xF5es de agendamento. Aguarde alguns minutos."
  });
  app.post("/api/public/bookings", bookingLimiter, async (req, res) => {
    let body = req.body || {}, appointment = body.appointment, date = typeof appointment?.date == "string" ? appointment.date : "", startTime = typeof appointment?.startTime == "string" ? appointment.startTime : "", clientName = typeof appointment?.clientName == "string" ? appointment.clientName.trim() : "";
    if (!appointment || !date || !startTime || !clientName) {
      res.status(400).json({ error: "Dados do agendamento incompletos." });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || clientName.length > 120) {
      res.status(400).json({ error: "Data, hor\xE1rio ou nome inv\xE1lidos." });
      return;
    }
    let disk = readRealtimeDisk(), appointments = parseRealtimeJson(
      disk.keys.pk_detail_appointments_v1,
      []
    ), clients = parseRealtimeJson(disk.keys.pk_detail_clients_v1, []), motorcycles = parseRealtimeJson(disk.keys.pk_detail_motorcycles_v1, []), blockedStatuses = ["cancelado", "nao_compareceu"];
    if (appointments.find((existing) => !existing || typeof existing != "object" || existing.id === appointment.id || existing.date !== date || existing.startTime !== startTime ? !1 : !blockedStatuses.includes(String(existing.status)))) {
      res.status(409).json({ error: "Este hor\xE1rio j\xE1 foi reservado por outro cliente." });
      return;
    }
    let onlyDigits = (value) => String(value || "").replace(/\D/g, ""), phoneDigits = onlyDigits(body.client?.phone || appointment.clientPhone), plate = String(appointment.motorcyclePlate || body.motorcycle?.plate || "").toUpperCase().trim(), storedClient = null, clientId = String(appointment.clientId || body.client?.id || ""), knownClient = clients.find((candidate) => !candidate || typeof candidate != "object" ? !1 : clientId && candidate.id === clientId ? !0 : phoneDigits.length >= 8 && onlyDigits(candidate.phone) === phoneDigits);
    if (knownClient)
      storedClient = knownClient, clientId = String(knownClient.id || clientId);
    else if (body.client) {
      let rawClient = body.client;
      storedClient = {
        id: sanitizeBookingText(rawClient.id, 64) || `cli_${Date.now()}`,
        name: sanitizeBookingText(rawClient.name, 120) || clientName,
        phone: sanitizeBookingText(rawClient.phone, 32) || String(appointment.clientPhone || ""),
        whatsapp: sanitizeBookingText(rawClient.whatsapp, 32),
        email: sanitizeBookingText(rawClient.email, 160),
        document: sanitizeBookingText(rawClient.document, 32),
        address: sanitizeBookingText(rawClient.address, 240),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        totalSpent: 0,
        visitsCount: 0,
        loyaltyPoints: 0,
        loyaltyTier: "bronze",
        tags: []
      }, clients.unshift(storedClient), clientId = String(storedClient.id);
    }
    let storedMotorcycle = null, motorcycleId = String(appointment.motorcycleId || body.motorcycle?.id || ""), knownMotorcycle = motorcycles.find((candidate) => !candidate || typeof candidate != "object" ? !1 : motorcycleId && candidate.id === motorcycleId ? !0 : plate.length >= 5 && String(candidate.plate || "").toUpperCase().trim() === plate);
    if (knownMotorcycle)
      storedMotorcycle = knownMotorcycle, motorcycleId = String(knownMotorcycle.id || motorcycleId);
    else if (body.motorcycle) {
      let rawMoto = body.motorcycle, rawYear = Number(rawMoto.year), rawCc = Number(rawMoto.cc);
      storedMotorcycle = {
        id: sanitizeBookingText(rawMoto.id, 64) || `mot_${Date.now()}`,
        brand: sanitizeBookingText(rawMoto.brand, 60),
        model: sanitizeBookingText(rawMoto.model, 80),
        plate: plate.slice(0, 10),
        year: Number.isFinite(rawYear) ? Math.max(1900, Math.min(2100, Math.round(rawYear))) : void 0,
        cc: Number.isFinite(rawCc) ? Math.max(0, Math.min(3e3, Math.round(rawCc))) : void 0,
        color: sanitizeBookingText(rawMoto.color, 40),
        category: sanitizeBookingText(rawMoto.category, 40)
      }, motorcycles.unshift(storedMotorcycle), motorcycleId = String(storedMotorcycle.id);
    }
    let rawPrice = Number(appointment.price), rawDuration = Number(appointment.durationMinutes), storedAppointment = {
      id: sanitizeBookingText(appointment.id, 64) || `apt_${Date.now()}`,
      clientId,
      clientName,
      clientPhone: sanitizeBookingText(appointment.clientPhone, 32),
      motorcycleId: motorcycleId || sanitizeBookingText(appointment.motorcycleId, 64),
      motorcyclePlate: plate.slice(0, 10),
      motorcycleBrand: sanitizeBookingText(appointment.motorcycleBrand, 60),
      motorcycleModel: sanitizeBookingText(appointment.motorcycleModel, 80),
      serviceId: sanitizeBookingText(appointment.serviceId, 64),
      serviceName: sanitizeBookingText(appointment.serviceName, 120),
      price: Number.isFinite(rawPrice) ? Math.max(0, Math.min(1e5, rawPrice)) : 0,
      date,
      startTime,
      endTime: sanitizeBookingText(appointment.endTime, 5),
      durationMinutes: Number.isFinite(rawDuration) ? Math.max(5, Math.min(480, Math.round(rawDuration))) : 60,
      notes: sanitizeBookingText(appointment.notes, 500),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "agendado",
      isOnlineBooking: !0
    }, existingIndex = appointments.findIndex((item) => item && item.id === storedAppointment.id);
    existingIndex >= 0 ? appointments[existingIndex] = storedAppointment : appointments.unshift(storedAppointment);
    let changes = {
      pk_detail_appointments_v1: JSON.stringify(appointments)
    };
    storedClient && (changes.pk_detail_clients_v1 = JSON.stringify(clients)), storedMotorcycle && (changes.pk_detail_motorcycles_v1 = JSON.stringify(motorcycles));
    let revision = await applyRealtimeChanges(changes, "public-booking");
    res.json({
      ok: !0,
      revision,
      appointmentId: storedAppointment.id,
      clientId,
      motorcycleId
    });
  }), app.get("/api/events", requireAuth, (req, res) => {
    res.status(200), res.setHeader("Content-Type", "text/event-stream; charset=utf-8"), res.setHeader("Cache-Control", "no-cache, no-transform"), res.setHeader("Connection", "keep-alive"), res.setHeader("X-Accel-Buffering", "no"), res.flushHeaders();
    let connection = {
      res,
      clientId: String(req.query.clientId || "unknown")
    };
    sseConnections.add(connection), res.write(
      `data: ${JSON.stringify({ type: "hello", revision: readRealtimeDisk().revision })}

`
    );
    let heartbeat = setInterval(() => {
      try {
        res.write(`: ping

`);
      } catch {
      }
    }, 25e3);
    req.on("close", () => {
      clearInterval(heartbeat), sseConnections.delete(connection);
    });
  }), app.get("/api/brand-identity", async (_req, res) => {
    let registry = await readRegistry();
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate"), res.json({
      activeLogo: registry.activeLogo,
      version: registry.version,
      isDefault: !registry.activeLogo,
      updatedAt: registry.updatedAt,
      audit: registry.audit.slice(0, 50)
    });
  }), app.get("/api/brand-identity/assets/:filename", async (req, res) => {
    let filename = String(req.params.filename || "");
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).json({ error: "Nome de arquivo inv\xE1lido." });
      return;
    }
    let mime = mimeFromAssetFilename(filename);
    if (res.setHeader("Content-Type", mime), res.setHeader("X-Content-Type-Options", "nosniff"), res.setHeader("Cache-Control", "public, max-age=31536000, immutable"), mime === "image/svg+xml" && res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox"
    ), isRedisEnabled()) {
      let asset = await getBrandAssetRemote(filename);
      if (!asset) {
        res.status(404).json({ error: "Logotipo n\xE3o encontrado no armazenamento." });
        return;
      }
      res.send(asset.buffer);
      return;
    }
    let absPath = path.join(ASSETS_DIR, filename);
    if (!absPath.startsWith(ASSETS_DIR + path.sep) || !fs.existsSync(absPath)) {
      res.status(404).json({ error: "Logotipo n\xE3o encontrado no armazenamento." });
      return;
    }
    res.sendFile(absPath);
  }), app.post("/api/brand-identity", requireAuth, requireRole(["admin"]), async (req, res) => {
    let session = req.pkSession, actor = { userId: session.userId, userName: session.userName, userRole: session.userRole }, body = req.body || {};
    if (!body.dataBase64 || typeof body.dataBase64 != "string") {
      res.status(400).json({ error: "Dados da imagem ausentes." });
      return;
    }
    let cleanFileName = sanitizeFileName(String(body.fileName || "logo")), resolved = resolveFormatAndExt(cleanFileName, String(body.mimeType || ""));
    if (!resolved) {
      res.status(400).json({
        error: "Formato n\xE3o permitido. Aceitos apenas PNG, JPG/JPEG, WEBP e SVG."
      });
      return;
    }
    let base64Payload = body.dataBase64.replace(/^data:[^;]+;base64,/, "").trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
      res.status(400).json({ error: "Codifica\xE7\xE3o de arquivo inv\xE1lida." });
      return;
    }
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(base64Payload, "base64");
    } catch {
      res.status(400).json({ error: "Falha ao decodificar arquivo enviado." });
      return;
    }
    if (fileBuffer.length === 0 || fileBuffer.length > MAX_LOGO_BYTES) {
      res.status(400).json({
        error: "Arquivo vazio ou superior ao limite permitido de 5 MB."
      });
      return;
    }
    if (resolved.format === "SVG") {
      let svgResult = sanitizeSvgBuffer(fileBuffer);
      if (!svgResult.ok) {
        res.status(400).json({ error: svgResult.error });
        return;
      }
      fileBuffer = svgResult.buffer;
    } else if (!hasValidMagicBytes(fileBuffer, resolved.mimeType)) {
      res.status(400).json({
        error: `O conte\xFAdo do arquivo n\xE3o corresponde ao formato ${resolved.format} declarado.`
      });
      return;
    }
    let current = await readRegistry(), hadPreviousLogo = !!current.activeLogo, nextVersion = current.version + 1, logoId = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, storedAssetName = `${logoId}_v${nextVersion}.${resolved.ext}`, storedAbsPath = path.join(ASSETS_DIR, storedAssetName), relativePath = `storage/brand-identity/assets/${storedAssetName}`, assetUrl = `/api/brand-identity/assets/${storedAssetName}?v=${nextVersion}`, uploadedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      if (isRedisEnabled())
        await putBrandAssetRemote(storedAssetName, fileBuffer.toString("base64"), resolved.mimeType);
      else {
        fs.writeFileSync(storedAbsPath, fileBuffer);
        let stat = fs.statSync(storedAbsPath);
        if (!stat.isFile() || stat.size === 0)
          throw new Error("Asset verification failed after write");
      }
    } catch {
      if (!isRedisEnabled() && fs.existsSync(storedAbsPath))
        try {
          fs.unlinkSync(storedAbsPath);
        } catch {
        }
      res.status(500).json({
        error: "Falha ao gravar arquivo no armazenamento permanente. A logo anterior foi preservada."
      });
      return;
    }
    let newRecord = {
      id: logoId,
      filePath: relativePath,
      assetUrl,
      fileName: cleanFileName,
      format: resolved.format,
      mimeType: resolved.mimeType,
      sizeBytes: fileBuffer.length,
      uploadedAt,
      updatedBy: actor.userName,
      updatedById: actor.userId,
      updatedByRole: actor.userRole,
      version: nextVersion
    }, actionType = hadPreviousLogo ? "ALTERAR_LOGO" : "ANEXAR_LOGO", auditEntry = {
      id: `brand_aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: actionType,
      logoId,
      fileName: cleanFileName,
      format: resolved.format,
      version: nextVersion,
      timestamp: uploadedAt,
      userName: actor.userName,
      userRole: actor.userRole,
      details: `${hadPreviousLogo ? "Substituiu" : "Anexou"} logomarca "${cleanFileName}" (${resolved.format}, v${nextVersion})`
    }, nextRegistry = {
      activeLogo: newRecord,
      version: nextVersion,
      updatedAt: uploadedAt,
      history: [newRecord, ...current.history].slice(0, 40),
      audit: [auditEntry, ...current.audit].slice(0, 100)
    };
    try {
      await writeRegistryAtomic(nextRegistry);
    } catch {
      res.status(500).json({
        error: "Falha ao atualizar registro global da identidade visual. A logo anterior foi mantida."
      });
      return;
    }
    res.setHeader("Cache-Control", "no-store"), res.status(201).json({
      activeLogo: nextRegistry.activeLogo,
      version: nextRegistry.version,
      isDefault: !1,
      updatedAt: nextRegistry.updatedAt,
      audit: nextRegistry.audit.slice(0, 50)
    });
  }), app.delete("/api/brand-identity", requireAuth, requireRole(["admin"]), async (req, res) => {
    let session = req.pkSession, actor = { userId: session.userId, userName: session.userName, userRole: session.userRole }, current = await readRegistry(), nowIso = (/* @__PURE__ */ new Date()).toISOString(), nextVersion = current.version + 1, prevLogo = current.activeLogo, auditEntry = {
      id: `brand_aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action: "REMOVER_LOGO",
      logoId: prevLogo?.id,
      fileName: prevLogo?.fileName,
      format: prevLogo?.format,
      version: nextVersion,
      timestamp: nowIso,
      userName: actor.userName,
      userRole: actor.userRole,
      details: prevLogo ? `Removeu logomarca "${prevLogo.fileName}" (v${prevLogo.version}) e restaurou identidade padr\xE3o PK Detail (v${nextVersion})` : `Restaurou identidade visual padr\xE3o PK Detail (v${nextVersion})`
    }, nextRegistry = {
      activeLogo: null,
      version: nextVersion,
      updatedAt: nowIso,
      // Keep historical asset files intact on disk so previously emitted documents preserve issuance logo
      history: current.history,
      audit: [auditEntry, ...current.audit].slice(0, 100)
    };
    await writeRegistryAtomic(nextRegistry), res.setHeader("Cache-Control", "no-store"), res.json({
      activeLogo: null,
      version: nextRegistry.version,
      isDefault: !0,
      updatedAt: nextRegistry.updatedAt,
      audit: nextRegistry.audit.slice(0, 50)
    });
  }), app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota API n\xE3o encontrada." });
  }), app.use((err, _req, res, _next) => {
    let status = typeof err?.status == "number" ? Number(err.status) : 500;
    status >= 500 && secureLog("server.error", {
      message: err instanceof Error ? err.message.slice(0, 300) : "unknown"
    }), !res.headersSent && res.status(status === 400 ? 400 : status).json({
      error: status === 400 ? "Requisi\xE7\xE3o inv\xE1lida." : "Erro interno do servidor."
    });
  });
  let httpServer = http.createServer(app);
  if (process.env.NODE_ENV !== "production") {
    let isHmrDisabled = process.env.DISABLE_HMR === "true";
    isHmrDisabled && app.get("/@vite/client", (_req, res) => {
      res.type("application/javascript").send(`
import "/node_modules/vite/dist/client/env.mjs";
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay extends HTMLElement {}
`);
    });
    let { createServer: createViteServer } = await import("vite"), vite = await createViteServer({
      server: {
        middlewareMode: !0,
        hmr: isHmrDisabled ? !1 : { server: httpServer },
        ws: !isHmrDisabled,
        watch: isHmrDisabled ? null : {}
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    let distDir = path.resolve(process.cwd(), "dist"), NO_CACHE_FILES = /* @__PURE__ */ new Set(["sw.js", "manifest.json", "offline.html"]);
    app.use(
      express.static(distDir, {
        index: !1,
        maxAge: "1y",
        immutable: !0,
        setHeaders: (res, filePath) => {
          let base = path.basename(filePath);
          if (NO_CACHE_FILES.has(base) || base === "index.html") {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
            return;
          }
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return;
          }
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      })
    ), app.use((req, res) => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({ error: "Rota API n\xE3o encontrada." });
        return;
      }
      res.setHeader("Cache-Control", "no-cache, must-revalidate"), res.sendFile(path.join(distDir, "index.html"));
    });
  }
  return process.env.VERCEL === "1" || httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[PK Detail Server] running on http://0.0.0.0:${PORT}`);
  }), app;
}
var appPromise = startServer().catch((error) => {
  throw console.error("[PK Detail Server] falha ao iniciar:", error?.message || error), error;
});
async function pkDetailHandler(req, res) {
  (await appPromise)(req, res);
}
export {
  pkDetailHandler as default
};
