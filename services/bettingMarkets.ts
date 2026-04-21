/**
 * services/bettingMarkets.ts
 * 
 * Provides betting odds and market context to make AI predictions
 * more informed about current betting sentiment.
 */

export interface BettingMarket {
  market: string;
  outcomes: Array<{
    name: string;
    odds: number;
    probability: number; // calculated from odds
  }>;
}

export interface BettingContext {
  homeTeam: string;
  awayTeam: string;
  matchTime: string;
  markets: BettingMarket[];
  topOdds: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
}

/**
 * Calculate probability from decimal odds
 * Formula: 1 / odds = probability
 */
function oddsToProbability(odds: number): number {
  return Number((1 / odds * 100).toFixed(1));
}

/**
 * Mock betting data for demonstration
 * In production: integrate with Odds API, Pinnacle, or similar
 */
export function getMockBettingContext(
  homeTeam: string,
  awayTeam: string,
  homeFormPercent: number,
  awayFormPercent: number
): BettingContext {
  // Simulate odds based on team form (this is mock data)
  // In reality, fetch from betting API
  
  const homeFavor = homeFormPercent > awayFormPercent;
  const formDiff = Math.abs(homeFormPercent - awayFormPercent) / 100;

  // Base odds
  let homeOdds = homeFavor ? 1.8 - formDiff * 0.5 : 2.1 + formDiff * 0.5;
  let drawOdds = 3.2;
  let awayOdds = homeFavor ? 3.5 + formDiff * 0.5 : 2.8 - formDiff * 0.5;

  // Normalize odds
  homeOdds = Math.max(1.5, Math.min(5, homeOdds));
  drawOdds = Math.max(2.5, Math.min(5, drawOdds));
  awayOdds = Math.max(1.5, Math.min(5, awayOdds));

  return {
    homeTeam,
    awayTeam,
    matchTime: new Date().toISOString(),
    markets: [
      {
        market: "Match Odds",
        outcomes: [
          { name: "Home Win", odds: Number(homeOdds.toFixed(2)), probability: oddsToProbability(homeOdds) },
          { name: "Draw", odds: Number(drawOdds.toFixed(2)), probability: oddsToProbability(drawOdds) },
          { name: "Away Win", odds: Number(awayOdds.toFixed(2)), probability: oddsToProbability(awayOdds) },
        ],
      },
      {
        market: "Over/Under 2.5 Goals",
        outcomes: [
          { name: "Over 2.5", odds: 1.85, probability: oddsToProbability(1.85) },
          { name: "Under 2.5", odds: 2.05, probability: oddsToProbability(2.05) },
        ],
      },
      {
        market: "Both Teams to Score",
        outcomes: [
          { name: "Yes", odds: 1.72, probability: oddsToProbability(1.72) },
          { name: "No", odds: 2.15, probability: oddsToProbability(2.15) },
        ],
      },
    ],
    topOdds: {
      homeWin: Number(homeOdds.toFixed(2)),
      draw: Number(drawOdds.toFixed(2)),
      awayWin: Number(awayOdds.toFixed(2)),
    },
  };
}

/**
 * Identify "value" bets - markets where AI confidence diverges from market odds
 */
export function findValueBets(
  aiPrediction: {
    outcome: "home" | "draw" | "away";
    confidence: "Low" | "Medium" | "High";
  },
  marketOdds: BettingContext
) {
  const confidenceMap = { Low: 0.5, Medium: 0.65, High: 0.8 };
  const aiProbability = confidenceMap[aiPrediction.confidence];

  const valueBets: Array<{ market: string; reason: string; odds: number }> = [];

  for (const market of marketOdds.markets) {
    for (const outcome of market.outcomes) {
      const impliedProb = outcome.probability / 100;
      
      // Value bet: market undervalues what AI predicts
      if (aiPrediction.outcome === "home" && outcome.name === "Home Win" && impliedProb < aiProbability) {
        valueBets.push({
          market: `${market.market} - ${outcome.name}`,
          reason: `Odds at ${outcome.odds}, AI confidence ${aiPrediction.confidence}`,
          odds: outcome.odds,
        });
      }
      
      if (aiPrediction.outcome === "away" && outcome.name === "Away Win" && impliedProb < aiProbability) {
        valueBets.push({
          market: `${market.market} - ${outcome.name}`,
          reason: `Odds at ${outcome.odds}, AI confidence ${aiPrediction.confidence}`,
          odds: outcome.odds,
        });
      }
    }
  }

  return valueBets.slice(0, 2); // Return top 2 value bets
}

/**
 * Format betting context for AI consumption
 */
export function formatBettingForAI(context: BettingContext): string {
  const matchOdds = context.markets.find(m => m.market === "Match Odds");
  if (!matchOdds) return "";

  return `
BETTING MARKET CONTEXT:
Match Odds: ${context.homeTeam} ${matchOdds.outcomes[0].odds} | Draw ${matchOdds.outcomes[1].odds} | ${context.awayTeam} ${matchOdds.outcomes[2].odds}
Market Sentiment: Favors ${context.topOdds.homeWin < context.topOdds.awayWin ? context.homeTeam : context.awayTeam}
`.trim();
}
