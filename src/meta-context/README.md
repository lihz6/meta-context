# 一、createMetaContext

MetaContext 是 Context 的 Context, 通常 Context 包含的是一些值，但 MetaContext 包含的是其他 Context, 目的是简化项目中其他 Context 的访问和使用。一个项目中可能很多 Context, 但都可以通过唯一的入口 MetaContext 来访问和使用。

更重要的是，MetaContext 包含的 Context 不是普通的 Context, 更是一个个状态管理器，这些状态器是 StateChannel 的实例。通过 StateChannel 可实现组件状态的共享和同步，通过 MetaContext 又可实现状态的组合和隔离，两者结合起来可实现灵活的状态管理机制。

```tsx
// provide
<MetaContext.Provider value={{ context1, context2 }}>
  <RootComponent />
</MetaContext.Provider>;

// consume
import MetaContext from './MetaContext';

const { context1, context2 } = useContext(MetaContext);
const value1 = context1.useValue('value1');
const value2 = context2.useValue('value2');

// isolate context2
<MetaContext.Provider value={{ context1, context2: new StateChannel() }}>
  <SubRootComponent />
</MetaContext.Provider>;
```

# 二、StateChannel

StateChannel 用来提供一批相关状态的批量管理，在多个组件间进行实时通信和状态同步。

对比以下两种在同一组件内的基本使用：

1. 初始化两个状态state1和state2

```tsx
const [state1, setState1] = useState(initialState1);
const [state2, setState2] = useState(initialState2);
```

```tsx
const channel = useMemo(
  () =>
    new StateChannel({
      state1: initialState1,
      state2: initialState2,
    }),
  [],
);
const state1 = channel.useValue('state1');
const state2 = channel.useValue('state2');
```

2. 更新状态（或批量更新）

```tsx
setState1(newState1);
setState2(newState2);
```

```tsx
channel.dispatch('state1', newState1);
channel.dispatch('state2', newState2);

// 或批量更新
channel.dispatch({ state1: newState1, state2: newState2 });
```

3. 监听状态的变化（StateChannel能做到不同组件间的实时监听）

```tsx
useEffect(() => {
  // state1 changed.
}, [state1]);
```

```tsx
useEffect(() => {
  return channel.subscribe('state1', state1 => {
    // state1 changing.
  });
}, []);
```

4. StateChannel可在回调等避免不必要的依赖（和不必要的渲染）

```tsx
const handler = useCallback(() => {
  if (state1) {
    // todo
  }
}, [state1]);
```

```tsx
const handler = useCallback(() => {
  // 注意 useValue 和 getValue 的区别，此处不能用 useValue
  if (channel.getValue('state1')) {
    // todo
  }
}, []);
```
