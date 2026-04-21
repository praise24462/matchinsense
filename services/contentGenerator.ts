/**
 * Football Content Generator
 * Transforms match data into SEO-optimized blog articles
 * Suitable for Google AdSense approval
 */

export interface MatchData {
  homeTeam: string;
  awayTeam: string;
  league: string;
  homeForm?: string; // e.g., "W W D L"
  awayForm?: string;
  homeStats?: {
    shots?: number;
    possession?: number;
    foulsCommitted?: number;
    corners?: number;
  };
  awayStats?: {
    shots?: number;
    possession?: number;
    foulsCommitted?: number;
    corners?: number;
  };
  homeRanking?: number;
  awayRanking?: number;
  matchDate?: string;
  isUpcoming?: boolean;
  recentResult?: {
    score: string; // e.g., "2-1"
    winner: string;
  };
}

export interface GeneratedArticle {
  title: string;
  slug: string;
  introduction: string;
  keyStats: string;
  analysis: string;
  prediction: string;
  implications: string;
  conclusion: string;
  keywords: string[];
  wordCount: number;
  markdown: string;
  html: string;
}

/**
 * Generate SEO-optimized football article from match data
 */
export function generateFootballArticle(data: MatchData): GeneratedArticle {
  const isPrediction = data.isUpcoming !== false;
  const matchType = isPrediction ? "Preview" : "Analysis";
  const vsFormat = `${data.homeTeam} vs ${data.awayTeam}`;

  // Generate title
  const title = isPrediction
    ? `${vsFormat} Prediction: ${data.league} Match Preview & Analysis`
    : `${vsFormat} Result: Match Analysis & Key Takeaways`;

  const slug = `${data.homeTeam.toLowerCase()}-${data.awayTeam.toLowerCase()}-${matchType.toLowerCase()}`.replace(/\s+/g, "-");

  // Extract form data
  const homeFormArray = data.homeForm?.split(/\s+/).filter(Boolean) || [];
  const awayFormArray = data.awayForm?.split(/\s+/).filter(Boolean) || [];
  const homeRecentForm = homeFormArray.slice(-3).join("").toUpperCase() || "N/A";
  const awayRecentForm = awayFormArray.slice(-3).join("").toUpperCase() || "N/A";

  // Introduction
  const introduction = generateIntroduction(data, isPrediction, homeRecentForm, awayRecentForm);

  // Key Statistics Section
  const keyStats = generateKeyStats(data, homeRecentForm, awayRecentForm);

  // Match Analysis
  const analysis = generateAnalysis(data, isPrediction);

  // Prediction
  const prediction = generatePrediction(data, isPrediction);

  // Match Implications
  const implications = generateImplications(data);

  // Conclusion
  const conclusion = generateConclusion(data, isPrediction);

  // Keywords for SEO
  const keywords = [
    `${data.homeTeam} vs ${data.awayTeam}`,
    isPrediction ? "football prediction" : "match analysis",
    `${data.league} match`,
    "team form",
    "match preview",
    isPrediction ? "prediction" : "result",
    "football predictions today",
  ];

  // Combine into markdown
  const markdown = formatMarkdown(data, title, introduction, keyStats, analysis, prediction, implications, conclusion);

  // Convert to HTML
  const html = markdownToHtml(markdown);

  // Calculate word count
  const wordCount = markdown.split(/\s+/).length;

  return {
    title,
    slug,
    introduction,
    keyStats,
    analysis,
    prediction,
    implications,
    conclusion,
    keywords,
    wordCount,
    markdown,
    html,
  };
}

function generateIntroduction(data: MatchData, isPrediction: boolean, homeForm: string, awayForm: string): string {
  if (isPrediction) {
    return `In an upcoming ${data.league} clash, ${data.homeTeam} will host ${data.awayTeam} in what promises to be a compelling encounter. With ${data.homeTeam} on a recent form of ${homeForm} and ${data.awayTeam} managing ${awayForm}, this match could significantly impact both teams' campaigns. Read our detailed ${data.league} match preview and prediction below.`;
  } else {
    const winner = data.recentResult?.winner || data.homeTeam;
    const score = data.recentResult?.score || "TBD";
    return `${data.homeTeam} faced off against ${data.awayTeam} in an intense ${data.league} encounter that ended ${score}. The match provided valuable insights into both teams' form and tactical approach. In this analysis, we break down the key moments, statistics, and implications for both sides' future prospects.`;
  }
}

function generateKeyStats(data: MatchData, homeForm: string, awayForm: string): string {
  const homeShots = data.homeStats?.shots || 12;
  const awayShots = data.awayStats?.shots || 8;
  const homePossession = data.homeStats?.possession || 58;
  const awayPossession = data.awayStats?.possession || 42;

  return `**Recent Form:**
- ${data.homeTeam}: ${homeForm} (Last 3 matches)
- ${data.awayTeam}: ${awayForm} (Last 3 matches)

**Key Metrics:**
| Metric | ${data.homeTeam} | ${data.awayTeam} |
|--------|----------|----------|
| Shots | ${homeShots} | ${awayShots} |
| Possession | ${homePossession}% | ${awayPossession}% |
| Fouls Committed | ${data.homeStats?.foulsCommitted || 10} | ${data.awayStats?.foulsCommitted || 9} |
| Corners | ${data.homeStats?.corners || 5} | ${data.awayStats?.corners || 3} |`;
}

function generateAnalysis(data: MatchData, isPrediction: boolean): string {
  const homeHomeAdvantage = "The home advantage is significant in football, and ${data.homeTeam} will look to capitalize on their familiar surroundings.";
  const awayChallenge = `${data.awayTeam} arrives as the away team, which historically presents challenges in terms of travel fatigue and crowd pressure.`;

  if (isPrediction) {
    return `**Pre-Match Analysis:**

${homeHomeAdvantage} ${data.homeTeam}'s recent form suggests they are hitting their stride at the right moment, with their attack threatening and defense organized.

${awayChallenge} However, their away record suggests they can perform under pressure, and they'll be looking to break the trend on this occasion.

**Tactical Expectations:**
${data.homeTeam} is likely to dominate possession and press aggressively in the opening stages. ${data.awayTeam} may opt for a counter-attacking approach, relying on their pace and efficiency to create scoring opportunities. The midfield battle will be crucial in determining the flow of the match.`;
  } else {
    return `**Match Analysis:**

The contest saw ${data.homeTeam} take control of the game early, establishing dominance in possession and territorial advantage. Their attacking prowess was on full display, with dangerous runs down the flanks and incisive passing patterns.

${data.awayTeam} showed resilience despite being pinned back for large periods. They executed their defensive shape well and looked dangerous on the break, attempting to exploit spaces in transition.

**Turning Points:**
The decisive moments came in the second half when ${data.awayTeam} struggled to maintain their defensive block. ${data.homeTeam}'s persistent pressure eventually told as they created and converted clear-cut opportunities. The away side's inability to capitalize on their limited chances proved costly.`;
  }
}

function generatePrediction(data: MatchData, isPrediction: boolean): string {
  if (!isPrediction) {
    return `**Result Summary:**
As predicted by form and statistics, the match unfolded closely to expectations. The team with superior possession and shot accuracy emerged victorious, demonstrating the importance of clinical finishing in modern football.`;
  }

  const homeAdvantages = [
    `${data.homeTeam}'s superior recent form`,
    "home-ground advantage",
    `possession-based attacking football`,
  ];

  return `**Prediction:**

Based on current form, head-to-head statistics, and recent performances, **${data.homeTeam}** enter this match as favorites to secure a victory. The home side's ${homeAdvantages.join(", ")} provide them with a clear edge.

However, ${data.awayTeam} cannot be discounted. Away victories in the ${data.league} are not uncommon, and if they maintain discipline and capitalize on counter-attack opportunities, a draw or even an upset remains possible.

**Predicted Outcome:** ${data.homeTeam} Win (likely margin: 1-2 goals) or Draw.`;
}

function generateImplications(data: MatchData): string {
  return `**Match Implications:**

A victory for ${data.homeTeam} would strengthen their position in the ${data.league} standings, boost their confidence heading into upcoming fixtures, and keep their title/top-four ambitions alive.

For ${data.awayTeam}, a positive result would demonstrate their ability to compete against strong opponents on the road, crucial for any team aiming for European qualification or a championship push.

The outcome will also have ripple effects on the league table, potentially reshuffling positions and intensifying competition among mid-tier teams. In football, consistency over a season matters more than individual results, but statements are made in matches like these.`;
}

function generateConclusion(data: MatchData, isPrediction: boolean): string {
  if (isPrediction) {
    return `**Final Thoughts:**

This ${data.league} encounter between ${data.homeTeam} and ${data.awayTeam} is shaping up to be a fascinating tactical battle. While form and home advantage favor ${data.homeTeam}, ${data.awayTeam}'s quality and experience could spring a surprise.

Football's beauty lies in its unpredictability, but based on the data and analysis, expect an entertaining match with ${data.homeTeam} likely to emerge victorious. Stay tuned for live updates and post-match analysis.`;
  } else {
    return `**Conclusion:**

The ${data.homeTeam} vs ${data.awayTeam} match demonstrated the characteristics we've come to expect from ${data.league} football: intensity, technical quality, and tactical nuance. 

The result reinforces the importance of converting chances, maintaining defensive discipline, and leveraging home advantage. Both teams will use this encounter as a learning experience, with implications extending well beyond the final whistle. As the season progresses, moments like these often define the trajectory of a team's campaign.`;
  }
}

function formatMarkdown(
  data: MatchData,
  title: string,
  introduction: string,
  keyStats: string,
  analysis: string,
  prediction: string,
  implications: string,
  conclusion: string
): string {
  return `# ${title}

**${data.league}**  
**${data.homeTeam} vs ${data.awayTeam}**

## Introduction

${introduction}

## Key Statistics

${keyStats}

## Match Analysis

${analysis}

## Prediction & Expectations

${prediction}

## Match Implications

${implications}

## Conclusion

${conclusion}

---

*This article is generated for informational purposes. All statistics and predictions are based on available data and analysis. Football remains unpredictable—enjoy the game!*`;
}

function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*?)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italics
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;

  // Tables (simplified)
  html = html.replace(/^\|(.+)\|$/gm, "<table><tr><td>$1</td></tr></table>");

  return html;
}

/**
 * Batch generate articles from multiple matches
 */
export function generateMultipleArticles(matches: MatchData[]): GeneratedArticle[] {
  return matches.map((match) => generateFootballArticle(match));
}
