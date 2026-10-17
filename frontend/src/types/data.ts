export interface Row {
  period: string;
  residence: string;
  hospital_city: string;
  hospital: string;
  sex: string;
  age: string;
  cid: string;
  n: number;
  deaths: number;
  death_n: number;
  days: number;
  days_n: number;
  cents: number;
  value_n: number;
  age_sum: number;
  age_n: number;
}
export interface Manifest {
  schema: number;
  status: "complete" | "partial" | "unavailable";
  generated_at: string | null;
  requested: { start: number; end: number };
  coverage: string[];
  failures: { period: string; reason: string }[];
  source: string;
  files: { year: number; file: string }[];
  geography: string | null;
  municipalities: Record<string, string>;
  hospitals: Record<string, string>;
  cid_labels: Record<string, string>;
  types: Record<string, string>;
  ages: string[];
  geography_source?: string;
  hospital_reference?: {
    source_url: string;
    reference_date: string;
    name_count: number;
    sha256?: string;
    table?: string;
  } | null;
  provenance?: Provenance[];
  quality?: Record<string, Quality>;
}
export interface Provenance {
  period: string;
  source: string;
  sha256: string;
  rows: number;
  pysus_version?: string;
  downloaded_at?: string;
  raw_file?: string;
  raw_sha256?: string;
  source_url?: string;
  transport?: string;
}
export interface Quality {
  source_rows: number;
  stroke_normal_rows: number;
  duplicate_rows: number;
  invalid_dates: number;
  missing_age: number;
  missing_death: number;
  missing_days: number;
  missing_value: number;
}
export interface GeoJSON {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { name: string; label: string; ibge: string };
    geometry: { type: string; coordinates: unknown };
  }[];
}
export interface Filters {
  start: string;
  end: string;
  municipality: string;
  dimension: "residence" | "hospital_city";
  sex: string;
  age: string;
  type: string;
}
export type Measures = Pick<
  Row,
  | "n"
  | "deaths"
  | "death_n"
  | "days"
  | "days_n"
  | "cents"
  | "value_n"
  | "age_sum"
  | "age_n"
>;
