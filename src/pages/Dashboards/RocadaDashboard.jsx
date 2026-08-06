import { PageHeader } from "../../components/PageHeader";
import { RocadaMetric } from "../DissallowancesControls/RocadaMetric";
import "./projectDashboards.css";
import "../DissallowancesControls/rocada.css";

export function RocadaDashboard() {
  return <main className="project-dashboard">
    <RocadaMetric endpoint="/glosas/rocada/dashboard" />
  </main>;
}
