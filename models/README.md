# 模型目录 / Models

把 `.glb` / `.gltf` 模型放进这个目录，然后在 `manifest.json` 里登记，游戏启动时会自动加载。
**你不需要改任何代码** —— 加载、卡通着色、描边、阴影、球面放置、动画都由管线自动处理。

## 加载流程做了什么

每个模型加载后会自动：

1. 把材质转换为吉卜力卡通着色（`MeshToonMaterial` + 共享渐变色阶 + 柔和 rim light）
2. 开启投影 / 接收阴影
3. （可选）加内凹外壳描边轮廓
4. （可选）按给定法线方向贴合到球面并朝向指定方向
5. （可选）播放 GLTF 内嵌的骨骼动画

## manifest.json 字段

```jsonc
{
  "models": [
    {
      "id": "post-office",          // 唯一名字，省略则用 url
      "url": "/models/post-office.glb",
      "normal": [0.5, 0.3, 0.8],    // 球面上的单位方向（会自动归一化）
      "offset": 0.02,               // 抬离地表的高度
      "forward": [0, 0, -1],        // 朝向（会投影到切平面）
      "rotateY": 45,                // 额外偏航角，单位：度
      "scale": 0.8,                 // 统一缩放
      "outline": true,              // 描边；或 { "color": "#33261c", "thickness": 0.02 }
      "animate": "Idle",            // 指定动画片段名；true/"all" 播放全部；false 不播放；默认播放全部
      "toon": true                  // 设为 false 可保留模型原始材质
    }
  ]
}
```

`url` 是唯一必填项。省略 `normal` 时模型会放在世界原点（行星中心），一般都应该给一个方向。

## 支持的压缩格式

- **DRACO** 几何压缩：解码器已配置好（`/vendor/three/examples/jsm/libs/draco/gltf/`）
- **Meshopt** 压缩：解码器已挂载

导出带压缩的 `.glb` 直接能用，无需额外配置。

## 运行时手动加载

调试时也可以在浏览器控制台按需加载：

```js
await window.__messengerClone.loadModel("/models/tree.glb", {
  normal: [0, 1, 0], offset: 0.02, scale: 1.2, outline: true
});
window.__messengerClone.getLoadedModels(); // 已加载模型 id 列表
```

## 示例

`demo-crate.gltf` 是一个验证管线用的木箱示例，在 `manifest.json` 里有对应条目。
换成你自己的模型后，把这个示例条目删掉即可。
