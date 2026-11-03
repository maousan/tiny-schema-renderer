import Renderer from "./renderer/RenderMain";

// web-erp: 暴露物料注册与宿主配置 API，供宿主应用注入物料/TinyVue/错误钩子（ADR-0038 收编）
export { registerMaterials, setConfigure } from "./renderer/render";

export default Renderer;
