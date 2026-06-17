export type PlatformInput = {
  computeThroughputTflops: number;
  memoryBandwidthTbps: number;
  memoryCapacityGb: number;
  computeEfficiency: number;
  bandwidthEfficiency: number;
  batchSize: number;
  precisionAssumptions: string;
  useMemoryCeilingClamp: boolean;
};

