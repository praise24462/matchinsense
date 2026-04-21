"use client";
import React, { useState, useEffect } from "react";
import styles from "./BettingMarkets.module.scss";

interface BettingOutcome {
  name: string;
  odds: number;
  probability: number;
}

interface BettingMarket {
  market: string;
  outcomes: BettingOutcome[];
}

interface ValueBet {
  market: string;
  reason: string;
  odds: number;
}

interface BettingContextData {
  homeTeam: string;
  awayTeam: string;
  markets: BettingMarket[];
  topOdds: {
    homeWin: number;
    draw: number;
    awayWin: number;
  };
  valueBets?: ValueBet[];
}

export default function BettingMarkets({
  homeTeam,
  awayTeam,
  homeFormPercent,
  awayFormPercent,
  predictionConfidence,
  predictionOutcome,
}: {
  homeTeam: string;
  awayTeam: string;
  homeFormPercent?: number;
  awayFormPercent?: number;
  predictionConfidence?: "Low" | "Medium" | "High";
  predictionOutcome?: "home" | "draw" | "away";
}) {
  const [data, setData] = useState<BettingContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // For now, we'll use mock betting context from the bettingMarkets service
    // In production, integrate with a real betting odds API
    try {
      // Simulate API call with mock data
      const mockData: BettingContextData = {
        homeTeam,
        awayTeam,
        markets: [
          {
            market: "Match Winner",
            outcomes: [
              { name: "Home Win", odds: 1.95, probability: 51.3 },
              { name: "Draw", odds: 3.4, probability: 29.4 },
              { name: "Away Win", odds: 3.8, probability: 26.3 },
            ],
          },
          {
            market: "Over/Under 2.5 Goals",
            outcomes: [
              { name: "Over 2.5", odds: 1.85, probability: 54.1 },
              { name: "Under 2.5", odds: 2.05, probability: 48.8 },
            ],
          },
          {
            market: "Both Teams to Score",
            outcomes: [
              { name: "Yes", odds: 1.72, probability: 58.1 },
              { name: "No", odds: 2.15, probability: 46.5 },
            ],
          },
        ],
        topOdds: {
          homeWin: 1.95,
          draw: 3.4,
          awayWin: 3.8,
        },
      };

      // Calculate value bets if prediction is provided
      if (predictionConfidence && predictionOutcome) {
        const confidenceMap = {
          Low: 0.5,
          Medium: 0.65,
          High: 0.8,
        };
        const aiProbability = confidenceMap[predictionConfidence];

        const valueBets: ValueBet[] = [];
        for (const market of mockData.markets) {
          for (const outcome of market.outcomes) {
            const impliedProb = outcome.probability / 100;

            if (
              predictionOutcome === "home" &&
              outcome.name === "Home Win" &&
              impliedProb < aiProbability
            ) {
              valueBets.push({
                market: `${market.market} - ${outcome.name}`,
                reason: `Odds at ${outcome.odds}, AI confidence ${predictionConfidence}`,
                odds: outcome.odds,
              });
            }

            if (
              predictionOutcome === "away" &&
              outcome.name === "Away Win" &&
              impliedProb < aiProbability
            ) {
              valueBets.push({
                market: `${market.market} - ${outcome.name}`,
                reason: `Odds at ${outcome.odds}, AI confidence ${predictionConfidence}`,
                odds: outcome.odds,
              });
            }
          }
        }

        mockData.valueBets = valueBets.slice(0, 2);
      }

      setData(mockData);
    } catch (err: any) {
      console.error("Betting markets error:", err);
      setError(err?.message || "Failed to load betting data");
    } finally {
      setLoading(false);
    }
  }, [homeTeam, awayTeam, predictionConfidence, predictionOutcome]);

  if (loading) {
    return (
      <section className={styles.section}>
        <h2>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M12 6v6l4 2.35" />
          </svg>
          Betting Markets
        </h2>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.section}>
        <h2>Betting Markets</h2>
        <div className={styles.error}>{error || "Could not load betting data"}</div>
      </section>
    );
  }

  const matchOdds = data.markets.find((m) => m.market === "Match Winner");
  const homeWinProb = matchOdds?.outcomes[0].probability || 0;
  const drawProb = matchOdds?.outcomes[1].probability || 0;
  const awayWinProb = matchOdds?.outcomes[2].probability || 0;

  return (
    <section className={styles.section}>
      <h2>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
          <rect x="3" y="2" width="18" height="20" rx="2" />
        </svg>
        Betting Markets & Odds
      </h2>

      {/* Top Odds */}
      <div className={styles.oddsGrid}>
        <div className={styles.oddsCard}>
          <div className={styles.oddsLabel}>{homeTeam} Win</div>
          <div className={styles.oddsValue}>{data.topOdds.homeWin.toFixed(2)}</div>
          <div className={styles.oddsProbability}>{homeWinProb.toFixed(1)}% probability</div>
        </div>
        <div className={styles.oddsCard}>
          <div className={styles.oddsLabel}>Draw</div>
          <div className={styles.oddsValue}>{data.topOdds.draw.toFixed(2)}</div>
          <div className={styles.oddsProbability}>{drawProb.toFixed(1)}% probability</div>
        </div>
        <div className={styles.oddsCard}>
          <div className={styles.oddsLabel}>{awayTeam} Win</div>
          <div className={styles.oddsValue}>{data.topOdds.awayWin.toFixed(2)}</div>
          <div className={styles.oddsProbability}>{awayWinProb.toFixed(1)}% probability</div>
        </div>
      </div>

      {/* Market Sentiment */}
      <div className={styles.sentiment}>
        <div className={styles.sentimentTitle}>Market Sentiment</div>
        <div className={styles.sentimentBar}>
          <div
            className={`${styles.sentimentSection} ${styles.home}`}
            style={{
              flex: homeWinProb,
            }}
          >
            {homeWinProb > 15 && `${homeWinProb.toFixed(0)}%`}
          </div>
          <div
            className={`${styles.sentimentSection} ${styles.draw}`}
            style={{
              flex: drawProb,
            }}
          >
            {drawProb > 15 && `${drawProb.toFixed(0)}%`}
          </div>
          <div
            className={`${styles.sentimentSection} ${styles.away}`}
            style={{
              flex: awayWinProb,
            }}
          >
            {awayWinProb > 15 && `${awayWinProb.toFixed(0)}%`}
          </div>
        </div>
        <div className={styles.sentimentStats}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{data.topOdds.homeWin.toFixed(2)}</div>
            <div className={styles.statLabel}>{homeTeam} Favored</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{data.topOdds.draw.toFixed(2)}</div>
            <div className={styles.statLabel}>Draw Odds</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{data.topOdds.awayWin.toFixed(2)}</div>
            <div className={styles.statLabel}>{awayTeam} Underdogs</div>
          </div>
        </div>
      </div>

      {/* Value Bets */}
      {data.valueBets && data.valueBets.length > 0 && (
        <div className={styles.valueBets}>
          <div className={styles.valueBetsTitle}>💎 Potential Value Bets</div>
          <div className={styles.valueBetsList}>
            {data.valueBets.map((bet, idx) => (
              <div key={idx} className={styles.valueBet}>
                <div className={styles.valueBetMarket}>
                  {bet.market} @ {bet.odds.toFixed(2)}
                </div>
                <div className={styles.valueBetReason}>{bet.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markets */}
      <div className={styles.marketsContainer}>
        <h3>Available Markets</h3>
        {data.markets.map((market, idx) => (
          <div key={idx} className={styles.marketCard}>
            <div className={styles.marketTitle}>{market.market}</div>
            <div className={styles.marketOutcomes}>
              {market.outcomes.map((outcome, odxIdx) => (
                <div key={odxIdx} className={styles.outcome}>
                  <div className={styles.outcomeName}>{outcome.name}</div>
                  <div className={styles.outcomeOdds}>{outcome.odds.toFixed(2)}</div>
                  <div className={styles.outcomeProbability}>
                    {outcome.probability.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "16px" }}>
        💡 <strong>Note:</strong> Odds shown are for demonstration based on team form. Integrate with
        real betting APIs for live odds.
      </div>
    </section>
  );
}
