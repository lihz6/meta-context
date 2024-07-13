# 声明式冒泡埋点上报方案

> 在数据驱动的项目中，埋点上报代码较难管理，比如分散在各处的埋点定义、在组件间层层传递的埋点参数等，开发者常常发现增加埋点上报要改动很多业务代码。合理的埋点上报设计可能要综合考虑很多问题，本方案提供一种基于 Context 的简化埋点上报的思路和实现，createCollectEvent 主要简化了两方面的问题：
>
> 1. 怎么定义埋点？避免重复或冲突的定义，不增加运行时代码体积
> 1. 怎么上报埋点？避免参数组件间层层传递，实现公参和公参隔离

## 一、createCollectEvent的使用

### 1. 埋点定义

推荐用一个 interface 集中定义所有埋点定义，因为 interface 不会引入任何运行时的代码体积；集中定义可以避免定义的重复或冲突，实现定义的复用和统一。如果担心一个 interface 定义所有埋点太大，也可以用 [interface merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces) 的技术拆分定义为多模块或多文件。

```ts
export interface CollectEvent {
  user_show: {
    theme_mode: 'dark' | 'light';
    enter_from: string;
    position: string;

    user_id: string;
  };
}

export interface CollectEvent {
  user_click: {
    theme_mode: 'dark' | 'light';
    enter_from: string;
    position: string;

    user_id: string;
    method: 'click' | 'hot_key';
  };
}
```

### 2. 埋点上报

现实中埋点上报往往污染组件的接口（比如要传各种埋点参数进来），也不得不上报一些与组件本身无关的参数（比如跟组件业务逻辑无关的公参）；但埋点上报或许可以更轻量和更简单，比如只需从固定唯一的引用获得上报函数 collectEvent, 只需上报与组件自身相关的参数，无需关心其他不相关的参数。

```ts
export const UserInfo = ({ id, name }) => {
  const collectEvent = useCollectEvent({});

  useEffect(() => {
    collectEvent('user_show', { user_id: id });
  }, [id]);

  return (
    <button
      onClick={() =>
        collectEvent('user_click', { user_id: id, method: 'click' })
      }
    >
      {name}
    </button>
  );
};
```

### 3. 冒泡补参

如果下层的子组件只上报了必要的参数，那么其他参数就需要上层父组件来补全。从子组件到父组件，埋点参数从下而上地层层叠加，最终得到完整的参数用以提交。这种参数补全和隔离可以通过 Context 来实现，通过 Provider 实现层层嵌套和相互隔离。

```ts
export const App = () => (
  <CollectEventProvider params={{ enter_from: "recommend" }}>
    <CollectEventProvider params={{ position: "author_card" }}>
      <UserInfo id="1201" name="Jane" />
    </CollectEventProvider>
  </CollectEventProvider>
);
```

### 4. 埋点提交

在 createCollectEvent 时，可能需要传入两个参数，一是要传入最基本公参的默认值（从 URL 或 storage 等获取），二是要传入统一上报埋点的提交函数；通用单点统一进行提交，就能够实现中间件的机制，方便埋点验证、监控和处理等。

```ts
const initialParams = {
  theme_mode: 'dark',
  enter_from: 'self',
};

export const { useCollectEvent, CollectEventProvider } = createCollectEvent(initialParams, (key, params) => {
  console.log('send event:', key, params);
});
```

## 二、createCollectEvent的实现

### 5. 最小实现

从上面使用部分看，只需 useCollectEvent 和 CollectEventProvider 即可满足需求，这两个 API 本质上就是 Context.Consumer 和 Context.Provider. 下面 createCollectEvent 利用 createContext 提供了一个最小有用实现。

```ts
export const createCollectEvent = (initialParams, collectEvent) => {
  const CollectEvent = createContext((key, params = {}) => collectEvent(key, { ...initialParams, ...params }));

  const useCollectEvent = (params = {}) => {
    const prevCollectEvent = useContext(CollectEvent);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    return useCallback((key, params = {}) => {
      prevCollectEvent(key, { ...paramsRef.current, ...params });
    }, []);
  };

  const CollectEventProvider = ({ params, children }) => (
    <CollectEvent.Provider value={useCollectEvent(params)}>{children}</CollectEvent.Provider>
  );

  return {
    CollectEventProvider,
    useCollectEvent,
  };
};
```

### 6. 控制反转

在 setState 时，除了最简单的 setState(newState), 还有更高级的 setState(oldState => newState), 这种高明的方式在生成 newState 时能够拥有更多的信息、表达更丰富的逻辑。在本埋点上报方案有四个接口可实现类似机制：

| setState(newState)                              | setState(oldState => newState)                          |
| ----------------------------------------------- | ------------------------------------------------------- |
| createCollectEvent(initialParams, collectEvent) | createCollectEvent(() => initialParams, collectEvent)   |
| \<CollectEventProvider params={params} />       | \<CollectEventProvider params={prevParams => params} /> |
| collectEvent(event, params)                     | collectEvent(event, prevParams => params)               |
| useCollectEvent(params)                         | useCollectEvent(prevParams => params)                   |

```ts
function getParams(value, prevValue) {
  const nextValue = typeof value === 'function' ? value(prevValue) : value;
  return { ...prevValue, ...nextValue };
}

export const createCollectEvent = (initialParams, collectEvent) => {
  const CollectEvent = createContext((key, params = {}) =>
    collectEvent(key, getParams(params, getParams(initialParams))),
  );

  const useCollectEvent = (params = {}) => {
    const prevCollectEvent = useContext(CollectEvent);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    return useCallback((key, params = {}) => {
      prevCollectEvent(key, prevParams => getParams(params, getParams(paramsRef.current, prevParams)));
    }, []);
  };

  const CollectEventProvider = ({ params, children }) => (
    <CollectEvent.Provider value={useCollectEvent(params)}>{children}</CollectEvent.Provider>
  );
  return {
    CollectEventProvider,
    useCollectEvent,
  };
};
```

### 7. 批量操作

有时同一时机可能要同时上报多埋点（比如同一个点击上报三个埋点，分别是产品相关埋点、算法相关埋点、研发相关埋点），此时可以把 collectEvent('event1', params1); collectEvent('event2', params2)... 重构为 collectEvent({ event1: params, event2: params2, ...}) 的批量操作。这种形式的调用也会获得更好的代码提示和类型支持。

```ts
function getParams(value, prevValue) {
  const nextValue = typeof value === 'function' ? value(prevValue) : value;
  return { ...prevValue, ...nextValue };
}

export const createCollectEvent = (initialParams, collectEvent) => {
  const batch = collect => {
    function batchCollectEvent(key, params) {
      Object.entries(typeof key === 'object' ? key : { [key]: params }).forEach(([key, params]) =>
        collect(key, params),
      );
    }
    return batchCollectEvent;
  };

  const CollectEvent = createContext(
    batch((key, params = {}) => collectEvent(key, getParams(params, getParams(initialParams)))),
  );

  const useCollectEvent = () => {
    const prevCollectEvent = useContext(CollectEvent);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    return useCallback(
      batch((key, params = {}) => {
        prevCollectEvent(key, prevParams => getParams(params, getParams(paramsRef.current, prevParams)));
      }), []
    );
  };

  const CollectEventProvider = ({ params, children }) => (
    <CollectEvent.Provider value={useCollectEvent(params)}>{children}</CollectEvent.Provider>
  );
  return {
    CollectEventProvider,
    useCollectEvent,
  };
};
```

### 8. 类型支持

类型不仅是代码，也是文档，不只是约束，更是安全边界。良好的类型支持可以增强代码的可读性和可维护性，提供更好的代码提示和辅助。以下是 createCollectEvent 加上类型支持后的完整实现，看起来很复杂，是为了使用上更简单。

> https://github.com/lihz6/meta-context/blob/master/src/collect-event/index.tsx
