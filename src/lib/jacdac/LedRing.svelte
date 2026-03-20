<script lang="ts">
  import { LedReg } from 'jacdac-ts';
  import type { JDService } from 'jacdac-ts';

  export let service: JDService;

  enum TestState {
    Idle = 'idle',
    Running = 'running',
    Pass = 'pass',
    Fail = 'fail',
  }

  interface TestResult {
    state: TestState;
    output: string;
  }

  let testState: TestResult = {
    state: TestState.Idle,
    output: '',
  };

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runTest() {
    testState = { state: TestState.Running, output: 'Running test...' };

    try {
      const testColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0x000000];
      const pixelsRegister = service.register(LedReg.Pixels);
      const numPixelsRegister = service.register(LedReg.NumPixels);

      let n: number | undefined;
      let attempts = 0;
      while (n === undefined && attempts < 10) {
        await numPixelsRegister.refresh(true);
        n = numPixelsRegister.uintValue;
        attempts++;
        if (n === undefined) await delay(100);
      }

      if (!n || n === 0) {
        testState = { state: TestState.Fail, output: 'No pixels found' };
        return;
      }

      // Cycle through colors and turn on pixels one by one
      const pixels = new Uint8Array(n * 3);
      let k = 0;
      while (k < testColors.length) {
        const color = testColors[k++ % testColors.length];
        for (let i = 0; i < n; ++i) {
          pixels[i * 3] = (color >> 16) & 0xff;
          pixels[i * 3 + 1] = (color >> 8) & 0xff;
          pixels[i * 3 + 2] = (color >> 0) & 0xff;
        }
        await pixelsRegister.sendSetPackedAsync([pixels], true);
        await delay(500);
      }

      testState = { state: TestState.Pass, output: 'Test passed!' };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      testState = { state: TestState.Fail, output: `Test failed: ${error}` };
    }
  }
</script>

<div class="led-test">
  <button
    on:click={runTest}
    disabled={testState.state === TestState.Running}
    class="run-button"
    class:running={testState.state === TestState.Running}
  >
    {testState.state === TestState.Running ? 'Running LED test...' : 'Run LED Test'}
  </button>

  {#if testState.output}
    <p class="test-output" class:success={testState.state === TestState.Pass} class:fail={testState.state === TestState.Fail}>
      {testState.output}
    </p>
  {/if}
</div>

<style>
  .led-test {
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .run-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border: 1px solid #2196f3;
    border-radius: 4px;
    background: #2196f3;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .run-button:hover:not(:disabled) {
    background: #1976d2;
    border-color: #1565c0;
  }

  .run-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .run-button.running {
    background: #ff9800;
  }

  .test-output {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    background: #e3f2fd;
    color: #1565c0;
  }

  .test-output.success {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .test-output.fail {
    background: #ffebee;
    color: #c62828;
  }
</style>
