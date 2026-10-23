import AqayePardakht from "./lib/aqayepardakht.js";

function configuredGateway() {
  const pin = process.env.AQAYEPARDAKHT_PIN?.trim();
  if (!pin) throw new Error('درگاه پرداخت پیکربندی نشده است.');
  return AqayePardakht(pin);
}

const aqayepardakht = {
  Create: (params) => configuredGateway().Create(params),
  Verify: (params) => configuredGateway().Verify(params),
  StartPay: (transid) => `https://panel.aqayepardakht.ir/startpay/${encodeURIComponent(transid)}`,
};

export { AqayePardakht };
export default aqayepardakht;
