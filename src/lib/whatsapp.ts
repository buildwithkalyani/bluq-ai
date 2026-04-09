const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

function getBaseUrl() {
  return `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
}

async function postToWhatsApp(body: object) {
  const res = await fetch(getBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[WhatsApp API Error]", res.status, err);
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
  return res.json();
}

export async function sendTextMessage(to: string, text: string) {
  return postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: { id: string; title: string }[]
) {
  return postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

export async function sendListMessage(
  to: string,
  body: string,
  buttonLabel: string,
  sections: { title: string; rows: { id: string; title: string }[] }[]
) {
  return postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: buttonLabel,
        sections,
      },
    },
  });
}
