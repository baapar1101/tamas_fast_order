import axios from "axios";

const removeEmpty = (obj) => {
  Object.keys(obj).forEach((key) => obj[key] === undefined && delete obj[key]);
  return obj;
};

const baseURL = "https://panel.aqayepardakht.ir/api/v2";

function AqayePardakht(pin) {
  if (typeof pin !== "string") {
    throw new Error("pin is invalid");
  }
  this.pin = pin;
  this.client = axios.create({ baseURL });
}

AqayePardakht.prototype.Create = function (params) {
  const body = removeEmpty({
    pin: this.pin,
    amount: params.amount,
    callback: params.callback,
    card_number: params.card_number,
    invoice_id: params.invoice_id,
    mobile: params.mobile,
    email: params.email,
    description: params.description,
  });

  return this.client.post("/create", body);
};

AqayePardakht.prototype.Verify = function (params) {
  const body = removeEmpty({
    pin: this.pin,
    amount: params.amount,
    transid: params.transid,
  });

  return this.client.post("/verify", body);
};

AqayePardakht.prototype.StartPay = function (transid) {
  return `https://panel.aqayepardakht.ir/startpay/${transid}`;
};

export default function AqayePardakhtApi(pin) {
  return new AqayePardakht(pin);
}