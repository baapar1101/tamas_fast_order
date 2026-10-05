import AqayePardakhtApi from "../lib/aqayepardakht.js";

const pin = process.env.AQAYEPARDAKHT_PIN;
if (!pin) {
  console.error("AQAYEPARDAKHT_PIN env missing");
  process.exit(2);
}

const gateway = AqayePardakhtApi(pin.trim());

try {
  const res = await gateway.Create({
    amount: 12_000,
    callback: "https://tamas-fast-order.ir/payment/callback",
    description: "تست اتصال درگاه (بدون انتقال پول)",
  });
  console.log("CREATE_STATUS", res.status);
  console.log("CREATE_RESPONSE", JSON.stringify(res.data));
} catch (err) {
  console.error(
    "CREATE_ERR",
    err?.response?.status,
    JSON.stringify(err?.response?.data ?? err?.message),
  );
  process.exitCode = 1;
}