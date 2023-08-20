import { TCCComponent } from './component';
import { RWMutex } from 'rw-mutex-ts';

export class registryCenter {
  constructor(
    public components: Map<string, TCCComponent> = new Map(),
    public mux: RWMutex = new RWMutex()
  ) {}

  register = async (component: TCCComponent) => {
    await this.mux.lock();
    const components = this.components.get(await component.ID());
    if (components) {
      throw Error('repeat component id');
    }
    this.components.set(await component.ID(), component);

    await this.mux.unlock();
  };

  getComponents = async (...componentIDs: string[]) => {
    try {
      await this.mux.lock();
      const res: TCCComponent[] = [];
      for (const componentID of componentIDs) {
        const components = this.components.get(componentID);
        if (components) {
          res.push(components);
        } else {
          throw Error(`component id: ${componentID} not existed`);
        }
      }

      return res;
    } finally {
      await this.mux.unlock();
    }
  };
}
