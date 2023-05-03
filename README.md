# Tays Terapeuttihakemiston jäsentelijä

Yksinkertainen ohjelma, joka kerää Taysin terapeuttihakemiston jäsenet yhteen tietolähteeseen.

## Kuvaus

Ohjelma käy säännöllisesti (kerran vuorokaudessa) läpi Taysin hakemiston terapeutit, jäsennellen ne yhteen. 
Terapeuttien tiedot poimitaan HTML-sivulta siinä muodossa kun ne olevat, joten esim. sähköpostiosoitteet säilyvät epäkäytettävässä muodossa
Tiedot tallennetaan Redis-palvelimelle, ja ohjelma tarjoaa rajapinnan koko tietueen noutamiseen.

### HTTP-rajapinta

* Vakio-osoite rajapinnalle on http://localhost:4500/api/therapists
* Käytössä olevan version osoite on http://terapeutit.laaksonen.eu/api/therapists

Terapeuttien data on seuraavanlainen:

```
type Terapeutti = {
  Etunimi: string;
  Sukunimi: string;
  Tilaa: string;
  Paikkakunta: string;
  Kohderyhmä: string;
  Vastaanotot: string[];
  Ajanvaraus: string;
  Kela: string;
  Kelalisätiedot: string;
  Kieli: string;
  Kotisivut: string;
  Koulutus: string;
  Lisätiedot: string;
  Puhelin: string;
  Suuntaus: string;
  Sähköposti: string;
  href?: string;
};
```


## Aloittaminen

### Vaatimukset

* Nodejs 16+ (fetch-tuki)
* Redis-palvelin

### Asentaminen

1. `git pull github.com/telaak/tays-terapeutit-backend.git`
2. Asenna paketit `npm i`
3. Aja TypeScript-kääntäjä `npx tsc`
4. Täytä vaadittavat ympäristömuuttujat:
      * REDIS=redis://redis:6379 (osoite Redis-palvelimeen)
      * FORCE_UPDATE=false (kertaluonteinen muuttuja, ajetaanko päivitys käynnittäessä)
      * REVALIDATE_TOKEN=jotain (Next-palvelinta varten, luo sivun uudestaan päivitetystä datasta)
      * NEXT_URL=http://terapeutit.laaksonen.eu (osoite Next-palvelimeen)
5. Käynnistä palvelin `node dist/index.js`


### Docker

## Build

* `docker build -t username/suomi24-ts`

## Compose

```
version: '3.8'

volumes:
  redis_data:

services:
  redis:
    image: redis/redis-stack-server
    restart: always
    volumes:
      - redis_data:/data
    
  backend:
    image: telaaks/tays-terapeutit-backend
    restart: always
    environment:
      - REDIS=redis://redis:6379
      - FORCE_UPDATE=false
      - REVALIDATE_TOKEN=jotain
      - NEXT_URL=http://terapeutit.laaksonen.eu
    ports:
      - 4500:4500
```

## License

This project is licensed under the MIT License - see the LICENSE.md file for details
