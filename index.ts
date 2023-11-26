import { createClient } from "redis";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import "dotenv/config";
import querystring from "node:querystring";

const app = express();
app.use(
  express.json({
    limit: "10MB",
  })
);
app.use(cors());
const server = createServer(app);
server.listen(4500);

const client = createClient({
  url: process.env.REDIS,
});

client.connect();

app.get("/api/therapists", async (req, res) => {
  const exists = await client.exists("therapists");
  if (!exists) {
    res.sendStatus(404);
  }
  try {
    const therapists = (await client.get("therapists")) as string;
    const therapistsJson = JSON.parse(therapists);
    res.json(therapistsJson);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/internal/therapists", async (req, res) => {
  try {
    await client.set("therapists", JSON.stringify(req.body));
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

const revalidateNext = async (queryStringObject: any) => {
  const queryString = querystring.encode(queryStringObject);
  console.log(queryString);
  return fetch(`${process.env.NEXT_URL}/api/revalidate?${queryString}`).then(
    (res) => res.json().then((json) => console.log(json))
  );
};

const purgeCloudflare = async () => {
  try {
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE}/purge_cache`,
      {
        method: "POST",
        mode: "cors",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        },
        body: JSON.stringify({
          purge_everything: true,
        }),
      }
    )
      .then((res) => res.json())
      .then(console.log);
  } catch (error) {
    console.error(error);
  }
};

async function revalidateEverything() {
  const therapists = (await client.get("therapists")) as string;
  const allTherapists = JSON.parse(therapists);
  await revalidateNext({ secret: process.env.REVALIDATE_TOKEN, path: "/" });
  for (const therapist of allTherapists) {
    await revalidateNext({
      secret: process.env.REVALIDATE_TOKEN,
      path: `/${therapist.Etunimi} ${therapist.Sukunimi}`,
    });
  }
  await purgeCloudflare();
}
