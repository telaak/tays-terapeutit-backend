import { JSDOM } from "jsdom";
import { createClient } from "redis";
import { createServer } from "http";
import express, { Response } from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
const server = createServer(app);
server.listen(4500);

const client = createClient({
  url: "redis://localhost:6379",
});

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

app.get("/api/therapists", async (req, res) => {
  const therapists = (await client.get("therapists")) as string;
  const therapistsJson = JSON.parse(therapists)
  res.json(therapistsJson);
});

client.connect().then(async () => {
  const therapists = (await client.get("therapists")) as string;
  const therapistsJson = JSON.parse(therapists);
  console.log(therapistsJson);
 // await client.disconnect();
});

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

  return therapists;
};

const parseTherapist = async (href: string) => {
  console.log(href);
  const html = await fetch(href).then((res) => res.text().then((html) => html));
  const document = new JSDOM(html).window.document;
  const table = document.querySelector("table") as HTMLTableElement;
  const rows = table.querySelectorAll("tr");
  const rowArray = Array.from(rows);
  let object: any = {};
  rowArray.slice(2).forEach((row) => {
    const key = row?.children[0]?.textContent
      ?.trim()
      .replace(/\s/g, "") as string;
    const value = row?.children[1]?.textContent?.trim();
    object[key] = value;
  });
  return object;
};
