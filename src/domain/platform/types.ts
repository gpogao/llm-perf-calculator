export type PlatformInput = {
  computeThroughputTflops: number;
  memoryBandwidthGbps: number;
  memoryCapacityGb: number;
  computeEfficiency: number;
  bandwidthEfficiency: number;
  batchSize: number;
  /** 每个权重参数的字节数（1 = FP8, 2 = BF16） */
  bytesPerWeight: number;
  /** 每个激活/cache 元素的字节数（2 = BF16） */
  bytesPerActivation: number;
  /** 每个专家权重的字节数（0.5 = FP4, 1 = FP8） */
  bytesPerExpert: number;
};
