import MatchesClient from "./matches/MatchesClient";

export default function HomePage() {
  return <MatchesClient initialMatches={[]} initialError={null} />;
}