export type TokenSweepMode = "fixed-step";

export type WorkloadInput = {
  prefillTokenLength: number;
  decodeContextLength: number;
  decodeOutputTokens: number;
  tokenRangeStart: number;
  tokenRangeEnd: number;
  tokenRangeStep: number;
  tokenSweepMode: TokenSweepMode;
};

