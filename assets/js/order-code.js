// assets/js/order-code.js
(() => {
  function decodeKYS(code) {
    if (typeof code !== "string") {
      return null;
    }
    const trimmed = code.trim();
    if (!trimmed.startsWith("KYS-")) {
      return null;
    }
    const payload = trimmed.slice(4).trim();
    if (!payload) {
      return null;
    }
    const parsed = tryParsePayload(payload);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const packageId = getFirstNumber(parsed, [
      "pid",
      "packageId",
      "pkgId",
      "paket",
      "package",
      "pkg",
      "p",
    ]);
    if (!Number.isFinite(packageId)) {
      return null;
    }
    const duration = getFirstNumber(parsed, [
      "dur",
      "durasi",
      "duration",
      "minutes",
      "minute",
      "min",
      "d",
    ]);
    const deadline = getFirstNumber(parsed, [
      "ddl",
      "deadline",
      "days",
      "day",
      "hari",
      "dl",
    ]);
    const orderDate = getFirstValue(parsed, [
      "ts",
      "orderDate",
      "order_date",
      "tanggalOrder",
      "tanggal_order",
      "od",
      "date",
      "tanggal",
    ]);
    return {
      packageId,
      duration: Number.isFinite(duration) ? duration : 0,
      deadline: Number.isFinite(deadline) ? deadline : 0,
      orderDate,
      raw: parsed,
    };
  }

  function tryParsePayload(payload) {
    const decoded = decodeBase64Payload(payload);
    if (!decoded) {
      return null;
    }
    try {
      return JSON.parse(decoded);
    } catch (error) {
      console.warn("Gagal parse JSON KYS payload:", error);
      return null;
    }
  }

  function decodeBase64Payload(payload) {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    try {
      return atob(padded);
    } catch (error) {
      console.warn("Gagal decode base64 payload KYS:", error);
      return null;
    }
  }

  function getFirstNumber(source, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
          return value;
        }
      }
    }
    return null;
  }

  function getFirstValue(source, keys) {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== null && typeof value !== "undefined" && String(value).trim() !== "") {
          return value;
        }
      }
    }
    return null;
  }

  window.OrderCode = window.OrderCode || {};
  window.OrderCode.decodeKYS = decodeKYS;
})();
