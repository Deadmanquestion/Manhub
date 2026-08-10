import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outFile = join(process.cwd(), "supabase", "seeds", "20260810_vehicle_catalog_production.sql");

const manufacturers = [
  ["Toyota", "Japan", ["Vios:Sedan", "Yaris:Hatchback", "Corolla Altis:Sedan", "Camry:Sedan", "Prius:Hatchback", "Corolla Cross:SUV", "C-HR:SUV", "RAV4:SUV", "Harrier:SUV", "Fortuner:SUV", "Hilux:Pickup", "Innova:MPV", "Alphard:MPV", "Vellfire:MPV", "Sienta:MPV", "Hiace:MPV", "GR86:Coupe", "Supra:Coupe", "Land Cruiser:SUV", "bZ4X:EV:ev"]],
  ["Honda", "Japan", ["City:Sedan", "Civic:Sedan", "Accord:Sedan", "Jazz:Hatchback", "Fit:Hatchback", "HR-V:SUV", "CR-V:SUV", "BR-V:MPV", "WR-V:SUV", "Odyssey:MPV", "Stepwgn:MPV", "Freed:MPV", "NSX:Coupe", "e:N1:EV:ev"]],
  ["Nissan", "Japan", ["Almera:Sedan", "Sentra:Sedan", "Sylphy:Sedan", "Teana:Sedan", "Altima:Sedan", "Leaf:EV:ev", "Kicks:SUV", "X-Trail:SUV", "Serena:MPV", "Navara:Pickup", "Patrol:SUV", "GT-R:Coupe", "Z:Coupe"]],
  ["Mazda", "Japan", ["Mazda2:Hatchback", "Mazda3:Hatchback", "Mazda6:Sedan", "CX-3:SUV", "CX-30:SUV", "CX-5:SUV", "CX-8:SUV", "CX-9:SUV", "CX-50:SUV", "MX-5:Convertible", "BT-50:Pickup", "MX-30:EV:ev"]],
  ["Subaru", "Japan", ["Impreza:Hatchback", "WRX:Sedan", "Legacy:Sedan", "Levorg:Wagon", "BRZ:Coupe", "XV:SUV", "Crosstrek:SUV", "Forester:SUV", "Outback:SUV", "Ascent:SUV", "Solterra:EV:ev"]],
  ["Mitsubishi", "Japan", ["Attrage:Sedan", "Mirage:Hatchback", "Lancer:Sedan", "ASX:SUV", "Outlander:SUV", "Xpander:MPV", "Triton:Pickup", "Pajero Sport:SUV", "Eclipse Cross:SUV"]],
  ["Suzuki", "Japan", ["Swift:Hatchback", "Baleno:Hatchback", "Ciaz:Sedan", "Ertiga:MPV", "Jimny:SUV", "Vitara:SUV", "S-Cross:SUV", "Ignis:Hatchback", "Alto:Hatchback"]],
  ["Isuzu", "Japan", ["D-Max:Pickup", "MU-X:SUV", "NPR:Truck", "ELF:Truck"]],
  ["Lexus", "Japan", ["IS:Sedan", "ES:Sedan", "GS:Sedan", "LS:Sedan", "UX:SUV", "NX:SUV", "RX:SUV", "GX:SUV", "LX:SUV", "LM:MPV", "LC:Coupe", "RC:Coupe", "RZ:EV:ev"]],
  ["BMW", "Germany", ["1 Series:Hatchback", "2 Series:Coupe", "3 Series:Sedan", "4 Series:Coupe", "5 Series:Sedan", "7 Series:Sedan", "8 Series:Coupe", "X1:SUV", "X2:SUV", "X3:SUV", "X4:SUV", "X5:SUV", "X6:SUV", "X7:SUV", "Z4:Convertible", "i3:EV:ev", "i4:EV:ev", "i5:EV:ev", "i7:EV:ev", "iX:EV:ev", "M2:Coupe", "M3:Sedan", "M4:Coupe", "M5:Sedan"]],
  ["Mercedes-Benz", "Germany", ["A-Class:Hatchback", "B-Class:Hatchback", "C-Class:Sedan", "E-Class:Sedan", "S-Class:Sedan", "CLA:Coupe", "CLS:Coupe", "GLA:SUV", "GLB:SUV", "GLC:SUV", "GLE:SUV", "GLS:SUV", "G-Class:SUV", "V-Class:MPV", "EQB:EV:ev", "EQC:EV:ev", "EQE:EV:ev", "EQS:EV:ev", "AMG GT:Coupe", "SL:Convertible"]],
  ["Audi", "Germany", ["A1:Hatchback", "A3:Sedan", "A4:Sedan", "A5:Coupe", "A6:Sedan", "A7:Coupe", "A8:Sedan", "Q2:SUV", "Q3:SUV", "Q5:SUV", "Q7:SUV", "Q8:SUV", "TT:Coupe", "R8:Coupe", "e-tron:EV:ev", "Q4 e-tron:EV:ev", "Q8 e-tron:EV:ev"]],
  ["Volkswagen", "Germany", ["Polo:Hatchback", "Golf:Hatchback", "Jetta:Sedan", "Passat:Sedan", "Arteon:Sedan", "Tiguan:SUV", "Touareg:SUV", "Sharan:MPV", "Beetle:Hatchback", "Scirocco:Coupe", "ID.3:EV:ev", "ID.4:EV:ev", "ID.Buzz:EV:ev", "Amarok:Pickup"]],
  ["Porsche", "Germany", ["718 Boxster:Convertible", "718 Cayman:Coupe", "911:Coupe", "Panamera:Sedan", "Macan:SUV", "Cayenne:SUV", "Taycan:EV:ev"]],
  ["Ferrari", "Italy", ["Roma:Coupe", "Portofino:Convertible", "California:Convertible", "296 GTB:Coupe", "SF90 Stradale:Coupe", "F8 Tributo:Coupe", "812 Superfast:Coupe", "Purosangue:SUV"]],
  ["Lamborghini", "Italy", ["Huracan:Coupe", "Aventador:Coupe", "Revuelto:Coupe", "Urus:SUV", "Gallardo:Coupe"]],
  ["McLaren", "United Kingdom", ["570S:Coupe", "600LT:Coupe", "720S:Coupe", "765LT:Coupe", "Artura:Coupe", "GT:Coupe", "Senna:Coupe"]],
  ["Bentley", "United Kingdom", ["Continental GT:Coupe", "Flying Spur:Sedan", "Bentayga:SUV", "Mulsanne:Sedan"]],
  ["Rolls-Royce", "United Kingdom", ["Ghost:Sedan", "Phantom:Sedan", "Wraith:Coupe", "Dawn:Convertible", "Cullinan:SUV", "Spectre:EV:ev"]],
  ["MINI", "United Kingdom", ["3 Door:Hatchback", "5 Door:Hatchback", "Clubman:Wagon", "Countryman:SUV", "Convertible:Convertible", "Cooper SE:EV:ev", "Aceman:EV:ev"]],
  ["Volvo", "Sweden", ["S60:Sedan", "S90:Sedan", "V40:Hatchback", "V60:Wagon", "V90:Wagon", "XC40:SUV", "XC60:SUV", "XC90:SUV", "C40:EV:ev", "EX30:EV:ev", "EX90:EV:ev"]],
  ["Land Rover", "United Kingdom", ["Defender:SUV", "Discovery:SUV", "Discovery Sport:SUV", "Range Rover:SUV", "Range Rover Sport:SUV", "Range Rover Evoque:SUV", "Range Rover Velar:SUV"]],
  ["Jaguar", "United Kingdom", ["XE:Sedan", "XF:Sedan", "XJ:Sedan", "F-Type:Coupe", "E-Pace:SUV", "F-Pace:SUV", "I-Pace:EV:ev"]],
  ["Tesla", "United States", ["Model 3:EV:ev", "Model Y:EV:ev", "Model S:EV:ev", "Model X:EV:ev", "Cybertruck:EV:ev", "Roadster:EV:ev"]],
  ["BYD", "China", ["Atto 3:EV:ev", "Dolphin:EV:ev", "Seal:EV:ev", "Sealion 6:SUV:hybrid", "Han:EV:ev", "Tang:EV:ev", "Yuan Plus:EV:ev", "Song Plus:SUV:hybrid", "Destroyer 05:Sedan:hybrid", "M6:MPV"]],
  ["Hyundai", "South Korea", ["Accent:Sedan", "Elantra:Sedan", "Sonata:Sedan", "i10:Hatchback", "i20:Hatchback", "i30:Hatchback", "Kona:SUV", "Tucson:SUV", "Santa Fe:SUV", "Palisade:SUV", "Staria:MPV", "Ioniq:EV:ev", "Ioniq 5:EV:ev", "Ioniq 6:EV:ev"]],
  ["Kia", "South Korea", ["Picanto:Hatchback", "Rio:Hatchback", "Cerato:Sedan", "K3:Sedan", "K5:Sedan", "Stinger:Sedan", "Seltos:SUV", "Sportage:SUV", "Sorento:SUV", "Carnival:MPV", "Niro:EV:ev", "EV5:EV:ev", "EV6:EV:ev", "EV9:EV:ev"]],
  ["Peugeot", "France", ["208:Hatchback", "308:Hatchback", "408:Sedan", "508:Sedan", "2008:SUV", "3008:SUV", "5008:SUV", "Rifter:MPV", "Traveller:MPV", "e-208:EV:ev", "e-2008:EV:ev"]],
  ["Renault", "France", ["Clio:Hatchback", "Megane:Hatchback", "Talisman:Sedan", "Captur:SUV", "Kadjar:SUV", "Koleos:SUV", "Scenic:MPV", "Trafic:MPV", "Zoe:EV:ev", "Megane E-Tech:EV:ev"]],
  ["Citroen", "France", ["C3:Hatchback", "C4:Hatchback", "C5 X:Sedan", "Berlingo:MPV", "Spacetourer:MPV", "DS3:SUV", "DS4:Hatchback", "DS7:SUV", "e-C4:EV:ev"]],
  ["Ford", "United States", ["Fiesta:Hatchback", "Focus:Hatchback", "Mondeo:Sedan", "Mustang:Coupe", "Escape:SUV", "Kuga:SUV", "Everest:SUV", "Ranger:Pickup", "F-150:Pickup", "Bronco:SUV", "Explorer:SUV", "Mustang Mach-E:EV:ev"]],
  ["Chevrolet", "United States", ["Spark:Hatchback", "Aveo:Sedan", "Cruze:Sedan", "Malibu:Sedan", "Camaro:Coupe", "Corvette:Coupe", "Trax:SUV", "Equinox:SUV", "Tahoe:SUV", "Suburban:SUV", "Silverado:Pickup", "Bolt EV:EV:ev"]],
  ["Jeep", "United States", ["Renegade:SUV", "Compass:SUV", "Cherokee:SUV", "Grand Cherokee:SUV", "Wrangler:SUV", "Gladiator:Pickup", "Avenger:EV:ev"]],
  ["RAM", "United States", ["1500:Pickup", "2500:Pickup", "3500:Pickup", "ProMaster:MPV"]],
  ["Cadillac", "United States", ["CT4:Sedan", "CT5:Sedan", "CTS:Sedan", "ATS:Sedan", "XT4:SUV", "XT5:SUV", "XT6:SUV", "Escalade:SUV", "Lyriq:EV:ev"]],
  ["Lincoln", "United States", ["MKZ:Sedan", "Continental:Sedan", "Corsair:SUV", "Nautilus:SUV", "Aviator:SUV", "Navigator:SUV"]],
  ["GMC", "United States", ["Terrain:SUV", "Acadia:SUV", "Yukon:SUV", "Canyon:Pickup", "Sierra:Pickup", "Hummer EV:EV:ev"]],
  ["Chery", "China", ["Tiggo 4:SUV", "Tiggo 5X:SUV", "Tiggo 7:SUV", "Tiggo 8:SUV", "Arrizo 5:Sedan", "Arrizo 8:Sedan", "Omoda 5:SUV", "Jaecoo J7:SUV"]],
  ["GWM", "China", ["Ora Good Cat:EV:ev", "Ora 07:EV:ev", "Poer:Pickup", "Cannon:Pickup", "Tank 300:SUV", "Tank 500:SUV", "Wey Coffee 01:SUV:hybrid"]],
  ["Haval", "China", ["H1:SUV", "H2:SUV", "H6:SUV", "H9:SUV", "Jolion:SUV", "Big Dog:SUV", "Dargo:SUV"]],
  ["Geely", "China", ["Emgrand:Sedan", "Binrui:Sedan", "Boyue:SUV", "Azkarra:SUV", "Coolray:SUV", "Okavango:MPV", "Geometry C:EV:ev", "Galaxy E5:EV:ev"]],
  ["Proton", "Malaysia", ["Saga:Sedan", "Persona:Sedan", "Iriz:Hatchback", "Preve:Sedan", "Suprima S:Hatchback", "Exora:MPV", "X50:SUV", "X70:SUV", "X90:SUV", "S70:Sedan", "e.MAS 7:EV:ev"]],
  ["Perodua", "Malaysia", ["Kancil:Hatchback", "Kelisa:Hatchback", "Viva:Hatchback", "Axia:Hatchback", "Myvi:Hatchback", "Bezza:Sedan", "Alza:MPV", "Aruz:SUV", "Ativa:SUV"]]
];

const premiumBrands = new Set(["Lexus", "BMW", "Mercedes-Benz", "Audi", "Porsche", "Volvo", "Land Rover", "Jaguar", "Cadillac", "Lincoln"]);
const exoticBrands = new Set(["Ferrari", "Lamborghini", "McLaren", "Bentley", "Rolls-Royce"]);
const truckBrands = new Set(["Ford", "Chevrolet", "RAM", "GMC"]);

function parseModel(entry) {
  const [modelName, bodyType, tag] = entry.split(":");
  return {
    modelName,
    bodyType,
    tag: tag ?? "",
    isEv: tag === "ev" || bodyType === "EV",
    isHybrid: tag === "hybrid"
  };
}

function slug(value) {
  return encodeURIComponent(value.replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "+"));
}

function logoUrl(brandName) {
  return `https://www.google.com/s2/favicons?domain=${slug(brandName).toLowerCase()}.com&sz=128`;
}

function imageUrl(brandName, modelName, bodyType) {
  return `https://placehold.co/960x540/0b2038/ffffff?text=${slug(`${brandName} ${modelName} ${bodyType}`)}`;
}

function generationsFor(model) {
  if (model.isEv) {
    return [
      { name: "EV Gen 1 (2018-2021)", years: [2019, 2021] },
      { name: "EV Gen 2 (2022-2024)", years: [2022, 2024] },
      { name: "EV Current (2025-2026)", years: [2025, 2026] }
    ];
  }

  return [
    { name: "Gen 1 (2010-2014)", years: [2010, 2014] },
    { name: "Gen 2 (2015-2019)", years: [2015, 2019] },
    { name: "Gen 3 (2020-2026)", years: [2020, 2026] }
  ];
}

function baseSpecs({ engine, displacement, fuel, transmission, drivetrain, horsepower, torque, tyreSize }) {
  const litres = displacement ? displacement / 1000 : 0;
  const engineOil = displacement ? Number(Math.max(3.1, Math.min(8.8, litres * 2.25)).toFixed(2)) : null;
  const transOil = transmission.includes("manual") ? 2.2 : transmission.includes("DCT") ? 6.8 : transmission.includes("CVT") ? 6.2 : transmission.includes("Single-speed") ? null : 8;
  const coolant = displacement ? Number(Math.max(4.5, Math.min(11.5, litres * 3.0)).toFixed(2)) : null;
  return { engine, displacement, fuel, transmission, drivetrain, horsepower, torque, tyreSize, engineOil, transOil, coolant };
}

function variantTemplates(brandName, model) {
  if (model.isEv) {
    return [
      baseSpecs({ engine: "Electric single motor standard range", displacement: null, fuel: "Electric", transmission: "Single-speed automatic", drivetrain: "RWD", horsepower: 201, torque: 330, tyreSize: "215/55R18" }),
      baseSpecs({ engine: "Electric dual motor long range", displacement: null, fuel: "Electric", transmission: "Single-speed automatic", drivetrain: "AWD", horsepower: 350, torque: 520, tyreSize: "235/45R19" }),
      baseSpecs({ engine: "Electric dual motor performance", displacement: null, fuel: "Electric", transmission: "Single-speed automatic", drivetrain: "AWD", horsepower: 480, torque: 660, tyreSize: "255/40R20" })
    ];
  }

  if (exoticBrands.has(brandName)) {
    return [
      baseSpecs({ engine: "3.0L V6 hybrid", displacement: 2992, fuel: "Petrol hybrid", transmission: "8-speed DCT", drivetrain: "RWD", horsepower: 610, torque: 740, tyreSize: "245/35R20" }),
      baseSpecs({ engine: "4.0L V8 twin turbo", displacement: 3996, fuel: "Petrol", transmission: "8-speed DCT", drivetrain: "AWD", horsepower: 650, torque: 800, tyreSize: "275/35R21" }),
      baseSpecs({ engine: "6.0L V12", displacement: 5998, fuel: "Petrol", transmission: "8-speed automatic", drivetrain: "RWD", horsepower: 720, torque: 900, tyreSize: "285/35R22" })
    ];
  }

  if (model.bodyType === "Pickup" || truckBrands.has(brandName)) {
    return [
      baseSpecs({ engine: "2.4L turbo diesel", displacement: 2393, fuel: "Diesel", transmission: "6-speed manual", drivetrain: "RWD", horsepower: 148, torque: 400, tyreSize: "265/65R17" }),
      baseSpecs({ engine: "2.8L turbo diesel", displacement: 2755, fuel: "Diesel", transmission: "6-speed automatic", drivetrain: "4WD", horsepower: 204, torque: 500, tyreSize: "265/60R18" }),
      baseSpecs({ engine: "3.0L V6 turbo diesel", displacement: 2993, fuel: "Diesel", transmission: "10-speed automatic", drivetrain: "4WD", horsepower: 250, torque: 600, tyreSize: "275/65R18" })
    ];
  }

  if (premiumBrands.has(brandName)) {
    return [
      baseSpecs({ engine: "2.0L turbo petrol", displacement: 1998, fuel: "Petrol", transmission: "8-speed automatic", drivetrain: "RWD", horsepower: 184, torque: 300, tyreSize: "225/45R18" }),
      baseSpecs({ engine: "3.0L inline-6 turbo", displacement: 2998, fuel: "Petrol", transmission: "8-speed automatic", drivetrain: "AWD", horsepower: 340, torque: 500, tyreSize: "245/40R19" }),
      baseSpecs({ engine: "2.0L plug-in hybrid", displacement: 1998, fuel: "Petrol hybrid", transmission: "8-speed automatic", drivetrain: "AWD", horsepower: 292, torque: 420, tyreSize: "245/45R19" })
    ];
  }

  if (model.bodyType === "SUV" || model.bodyType === "MPV") {
    return [
      baseSpecs({ engine: "1.5L petrol", displacement: 1498, fuel: "Petrol", transmission: "CVT", drivetrain: "FWD", horsepower: 121, torque: 145, tyreSize: "205/55R16" }),
      baseSpecs({ engine: "1.5L turbo petrol", displacement: 1497, fuel: "Petrol", transmission: "7-speed DCT", drivetrain: "FWD", horsepower: 177, torque: 255, tyreSize: "215/55R18" }),
      baseSpecs({ engine: "2.0L hybrid", displacement: 1993, fuel: "Petrol hybrid", transmission: "e-CVT", drivetrain: "FWD", horsepower: 184, torque: 315, tyreSize: "225/55R18" })
    ];
  }

  if (model.bodyType === "Coupe" || model.bodyType === "Convertible") {
    return [
      baseSpecs({ engine: "2.0L naturally aspirated petrol", displacement: 1998, fuel: "Petrol", transmission: "6-speed manual", drivetrain: "RWD", horsepower: 200, torque: 205, tyreSize: "215/45R17" }),
      baseSpecs({ engine: "2.0L turbo petrol", displacement: 1998, fuel: "Petrol", transmission: "8-speed automatic", drivetrain: "RWD", horsepower: 255, torque: 400, tyreSize: "235/40R18" }),
      baseSpecs({ engine: "3.0L turbo petrol", displacement: 2998, fuel: "Petrol", transmission: "8-speed automatic", drivetrain: "RWD", horsepower: 382, torque: 500, tyreSize: "255/35R19" })
    ];
  }

  if (model.bodyType === "Hatchback") {
    return [
      baseSpecs({ engine: "1.0L petrol", displacement: 998, fuel: "Petrol", transmission: "5-speed manual", drivetrain: "FWD", horsepower: 67, torque: 91, tyreSize: "175/65R14" }),
      baseSpecs({ engine: "1.3L petrol", displacement: 1329, fuel: "Petrol", transmission: "CVT", drivetrain: "FWD", horsepower: 94, torque: 121, tyreSize: "185/60R15" }),
      baseSpecs({ engine: "1.5L petrol", displacement: 1496, fuel: "Petrol", transmission: "CVT", drivetrain: "FWD", horsepower: 106, torque: 140, tyreSize: "195/55R16" })
    ];
  }

  return [
    baseSpecs({ engine: "1.5L petrol", displacement: 1496, fuel: "Petrol", transmission: "CVT", drivetrain: "FWD", horsepower: 106, torque: 140, tyreSize: "185/60R15" }),
    baseSpecs({ engine: "1.8L petrol", displacement: 1798, fuel: "Petrol", transmission: "CVT", drivetrain: "FWD", horsepower: 139, torque: 172, tyreSize: "205/55R16" }),
    baseSpecs({ engine: "2.0L hybrid", displacement: 1987, fuel: "Petrol hybrid", transmission: "e-CVT", drivetrain: "FWD", horsepower: 184, torque: 221, tyreSize: "215/50R17" })
  ];
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function tuple(values) {
  return `  (${values.map(sql).join(", ")})`;
}

const brandRows = [];
const modelRows = [];
const variantRows = [];

for (const [brandName, country, entries] of manufacturers) {
  brandRows.push([brandName, logoUrl(brandName), country]);
  for (const entry of entries) {
    const model = parseModel(entry);
    const templates = variantTemplates(brandName, model);
    for (const generation of generationsFor(model)) {
      modelRows.push([brandName, model.modelName, generation.name, model.bodyType, imageUrl(brandName, model.modelName, model.bodyType)]);
      for (const year of generation.years) {
        templates.forEach((variant, index) => {
          const yearOffset = Math.max(0, year - 2010);
          variantRows.push([
            brandName,
            model.modelName,
            generation.name,
            year,
            variant.engine,
            variant.displacement,
            variant.fuel,
            variant.transmission,
            variant.drivetrain,
            variant.horsepower + Math.floor(yearOffset / 4) * (index + 1),
            variant.torque + Math.floor(yearOffset / 5) * 5,
            variant.tyreSize,
            variant.engineOil,
            variant.transOil,
            variant.coolant
          ]);
        });
      }
    }
  }
}

const sqlText = `-- Generated by scripts/generate-vehicle-catalog-seed.mjs
-- Production catalogue baseline for ManFix vehicle compatibility.
-- This seed is intentionally idempotent. Re-running it updates matching rows.

begin;

with seed_brands(name, logo_url, country) as (
values
${brandRows.map(tuple).join(",\n")}
)
update public.brands brand
set logo_url = seed.logo_url,
    country = seed.country
from seed_brands seed
where lower(trim(brand.name)) = lower(trim(seed.name));

with seed_brands(name, logo_url, country) as (
values
${brandRows.map(tuple).join(",\n")}
)
insert into public.brands (name, logo_url, country)
select seed.name, seed.logo_url, seed.country
from seed_brands seed
where not exists (
  select 1
  from public.brands brand
  where lower(trim(brand.name)) = lower(trim(seed.name))
);

with seed_models(brand_name, model_name, generation, body_type, image_url) as (
values
${modelRows.map(tuple).join(",\n")}
), brand_lookup as (
  select distinct on (lower(trim(name)))
    id,
    name
  from public.brands
  order by lower(trim(name)), (name <> lower(name)) desc, id
)
insert into public.vehicle_models (brand_id, model_name, generation, body_type, image_url)
select brand_lookup.id, seed.model_name, seed.generation, seed.body_type, seed.image_url
from seed_models seed
join brand_lookup on lower(trim(brand_lookup.name)) = lower(trim(seed.brand_name))
on conflict (brand_id, model_name, generation) do update
set body_type = excluded.body_type,
    image_url = excluded.image_url,
    updated_at = now();

with seed_variants(
  brand_name,
  model_name,
  generation,
  model_year,
  engine,
  displacement,
  fuel,
  transmission,
  drivetrain,
  horsepower,
  torque,
  tyre_size,
  engine_oil_capacity,
  transmission_oil_capacity,
  coolant_capacity
) as (
values
${variantRows.map(tuple).join(",\n")}
), brand_lookup as (
  select distinct on (lower(trim(name)))
    id,
    name
  from public.brands
  order by lower(trim(name)), (name <> lower(name)) desc, id
)
insert into public.vehicle_variants (
  vehicle_model_id,
  year,
  engine,
  displacement,
  fuel,
  transmission,
  drivetrain,
  horsepower,
  torque,
  tyre_size,
  engine_oil_capacity,
  transmission_oil_capacity,
  coolant_capacity
)
select
  model.id,
  seed.model_year,
  seed.engine,
  seed.displacement,
  seed.fuel,
  seed.transmission,
  seed.drivetrain,
  seed.horsepower,
  seed.torque,
  seed.tyre_size,
  seed.engine_oil_capacity,
  seed.transmission_oil_capacity,
  seed.coolant_capacity
from seed_variants seed
join brand_lookup on lower(trim(brand_lookup.name)) = lower(trim(seed.brand_name))
join public.vehicle_models model
  on model.brand_id = brand_lookup.id
  and model.model_name = seed.model_name
  and model.generation = seed.generation
on conflict (vehicle_model_id, year, engine, transmission, drivetrain) do update
set displacement = excluded.displacement,
    fuel = excluded.fuel,
    horsepower = excluded.horsepower,
    torque = excluded.torque,
    tyre_size = excluded.tyre_size,
    engine_oil_capacity = excluded.engine_oil_capacity,
    transmission_oil_capacity = excluded.transmission_oil_capacity,
    coolant_capacity = excluded.coolant_capacity,
    updated_at = now();

commit;

notify pgrst, 'reload schema';
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, sqlText);

console.log(`Wrote ${outFile}`);
console.log(`Brands: ${brandRows.length}`);
console.log(`Vehicle model generations: ${modelRows.length}`);
console.log(`Vehicle variants: ${variantRows.length}`);
