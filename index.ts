import { JSDOM } from "jsdom";
import { createClient } from "redis";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
const server = createServer(app);
server.listen(4500);

const client = createClient({
  url: process.env.REDIS,
});

const therapistHrefSet: Set<string> = new Set();

const links = [
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Hahmo_eli_gestaltterapia",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Integratiivinen",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Kognitiivinen",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Kognitiivinen_kayttaytymisterapia",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Kognitiivisanalyyttinen",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Kriisi_ja_trauma",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Kuvataideterapia",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Musiikkiterapia",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Neuropsykologinen_kuntoutus",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Pariperheterapia",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Psykodynaaminen",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Ratkaisukeskeinen",
  "https://www.tays.fi/fi-FI/Sairaanhoitopiiri/Alueellinen_yhteistyo/Mielenterveystyo/Terapeuttirekisteri/Ryhmapsykoterapia",
];

cron.schedule("0 10 * * *", async () => {
  console.log("running every day at 10:00");
  try {
    await parseLinks();
    therapistHrefSet.clear();
  } catch (error) {
    console.error(error);
  }
});

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

client.connect().then(async () => {
  const forceUpdate = JSON.parse(process.env.FORCE_UPDATE as string);
  if (forceUpdate) {
    await parseLinks();
    therapistHrefSet.clear();
  }
  // await client.disconnect();
});

const revalidateNext = async () => {
  return fetch(
    `${process.env.NEXT_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}`
  ).then((res) => res.json().then((json) => console.log(json)));
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

const parseLinks = async () => {
  const allTherapists: any[] = [];
  for (const link of links) {
    const html = await fetch(link)
      .then((res) => res.text())
      .then((html) => html);
    const therapists = await parseHtml(html);
    allTherapists.push(...therapists);
  }
  console.log(allTherapists);
  await client.set("therapists", JSON.stringify(allTherapists));
  try {
    await revalidateNext();
    await purgeCloudflare();
  } catch (error) {
    console.log(error);
  }
};

const parseHtml = async (html: string) => {
  const document = new JSDOM(html).window.document;
  const table = document.querySelector("table") as HTMLTableElement;
  const rows = table.querySelectorAll("tr");
  const rowArray = Array.from(rows);
  const therapists: any[] = [];
  const sliced = rowArray.slice(1);
  for (const row of sliced) {
    const children = row.children;
    const fullName = children[0]?.firstElementChild?.textContent?.split(
      ","
    ) as string[];
    const href = children[0]?.firstElementChild?.getAttribute("href") as string;
    const Etunimi = fullName[1]?.trim();
    const Sukunimi = fullName[0]?.trim();
    const Tilaa = children[1]?.textContent?.trim();
    const Paikkakunta = children[2]?.textContent?.trim();
    const Kohderyhmä = children[3]?.textContent?.trim();
    if (therapistHrefSet.has(href)) {
      console.log(`duplicate: ${href}`);
    } else {
      therapistHrefSet.add(href);
      console.log(href);
      const moreData = await parseTherapist(`https://tays.fi/${href}`);
      therapists.push({
        Etunimi,
        Sukunimi,
        Tilaa,
        Paikkakunta,
        Kohderyhmä,
        ...moreData,
      });
    }
  }

  return therapists;
};

const parseTherapist = async (href: string) => {
  const html = await fetch(href).then((res) => res.text().then((html) => html));
  const document = new JSDOM(html).window.document;
  const table = document.querySelector("table") as HTMLTableElement;
  const rows = table.querySelectorAll("tr");
  const rowArray = Array.from(rows);
  const Vastaanotot = Array.from(rowArray[0].children)
    .filter((n) => n.textContent)
    .map((n) => n.textContent);
  let object: any = { Vastaanotot, href };
  rowArray.slice(2).forEach((row) => {
    const key = row?.children[0]?.textContent
      ?.trim()
      .replace(/\s/g, "") as string;
    const value = row?.children[1]?.textContent?.trim();
    object[key] = value;
  });
  return object;
};
