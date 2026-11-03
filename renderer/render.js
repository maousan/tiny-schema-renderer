/**
 * Copyright (c) 2023 - present TinyEngine Authors.
 * Copyright (c) 2023 - present Huawei Cloud Computing Technologies Co., Ltd.
 *
 * Use of this source code is governed by an MIT-style license.
 *
 * THE OPEN SOURCE SOFTWARE IN THIS PRODUCT IS DISTRIBUTED IN THE HOPE THAT IT WILL BE USEFUL,
 * BUT WITHOUT ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR
 * A PARTICULAR PURPOSE. SEE THE APPLICABLE LICENSES FOR MORE DETAILS.
 *
 */

import { h, provide, inject } from 'vue'
import { isHTMLTag } from '@vue/shared'
// web-erp: 移除 @vue/babel-plugin-jsx、@babel/core（浏览器端 JSX 降级本身损坏且拖重依赖）与 @opentiny/vue 静态导入
// web-erp: TinyVue 改经 configure.tinyVue 注入、Notify 改 configure.onWarn/onError 钩子，避免把 TinyVue 全家桶拖进宿主应用
// web-erp: 画布容器（CanvasRow/CanvasCol/CanvasRowColContainer/CanvasFlexBox/CanvasSection）不再静态内置 ——
// web-erp: 其上游包 dist 静态导入 @opentiny/vue 全量桶（不可 tree-shake），内置映射会让 TinyVue 必进宿主模块图；
// web-erp: web-erp 方言 v1 不使用 Row/Col 布局容器，宿主需要时经 registerMaterials 自行注册（见 demo src/main.js）
import {
  CanvasBox,
  CanvasIcon,
  CanvasText,
  CanvasSlot,
  CanvasImg,
  CanvasPlaceholder,
  CanvasRouterLink,
  CanvasRouterView
} from './builtin'

const customElements = {}
const [JS_EXPRESSION, JS_FUNCTION] = ['JSExpression', 'JSFunction']
const isOn = (key) => /^on[A-Z]\w*/.test(key)

// web-erp: 删除 transformJSX（@babel/core transformSync 浏览器端 JSX 编译）——web-erp 方言 v1 拒绝 JSX，
// 后端校验器在闸上拦截 JSX，渲染器这层只做「不支持 JSX」的纵深上报，不再做 babel 降级

const Mapper = {
  Icon: CanvasIcon,
  Text: CanvasText,
  div: CanvasBox,
  Slot: CanvasSlot,
  slot: CanvasSlot,
  Template: CanvasBox,
  Img: CanvasImg,
  CanvasPlaceholder,
  CanvasRouterLink,
  CanvasRouterView
}

export const collectionMethodsMap = {}

// web-erp: 宿主物料注册表，getComponent 中优先级最高（高于内置 Mapper 与 tinyVue native 兜底）
const materials = {}

/**
 * web-erp: 物料注册 API（幂等合并，同名物料后注册覆盖先注册）
 * @param {Record<string, Component>} materialsMap componentName -> 组件 的映射表
 */
export const registerMaterials = (materialsMap) => {
  Object.assign(materials, materialsMap)
}

/**
 * web-erp: 宿主注入契约（经 setConfigure 幂等合并进 configure）：
 * - tinyVue?: TinyVue 全量默认导出（如 `import TinyVue from '@opentiny/vue'`），
 *   作为未注册物料的 native 兜底查找表；不注入则无 TinyVue 兜底（渲染器不再静态依赖 @opentiny/vue）
 * - onError?: (error, context) => void 解析失败回调（表达式求值/函数声明解析）。
 *   context: { expression 原文, message 错误信息, scopeKeys 求值 scope 的 key 列表, jsx 是否 JSX 形态 }；
 *   未配置时 console.error 兜底，保证无静默失败
 * - onWarn?: (error, context) => void 方法运行期报错回调（generateFn 同步抛错与 promise reject）；
 *   未配置时 console.warn 兜底
 * - globals?: Record<string, unknown> 宿主注入的全局句柄（如 LCP SDK 实例 app），随 setSchema 种入页面上下文：
 *   种入次序为先展开 globals 再置页面 state（`{...globals, state}`），methods 随后并（现有次序）。
 *   同名覆盖方向（实证钉死，见 __tests__/renderMain.spec.js）：保留键 "state" 恒为页面 state 对象
 *   （覆盖 globals.state）；methods 键覆盖同名 globals 键；页面 state 数据嵌套于 "state" 键之下，
 *   与 globals 其它键天然不同层、不构成同键冲突
 * 注意：configure 同时承载上游画布容器配置（configure[componentName].isContainer 等），
 * 宿主注入字段请勿与 componentName 命名冲突；configure 导出仅供包内 RenderMain 读取，
 * 宿主一律经 setConfigure 注入
 */
export const configure = {}

export const setConfigure = (configureData) => {
  Object.assign(configure, configureData)
}

const getNative = (name) => {
  // web-erp: TinyVue 改经 configure.tinyVue 注入，未注入时返回 undefined（无 native 兜底）
  return configure.tinyVue?.[name]
}

// web-erp: 轻量 JSX 形态探测，仅用于挑选错误文案；不是校验闸（后端校验器才是第一道）
const looksLikeJSX = (value) =>
  typeof value === 'string' && /<\s*\/?\s*[A-Za-z][\s\S]*?>|<>\s*[\s\S]*?<\//.test(value)

// web-erp: 解析失败统一上报出口 —— onError 未配置时 console.error 兜底（无静默失败），调用方随后返回 undefined
const reportParseError = (error, expression, scope) => {
  // web-erp: JSX 语法必为 SyntaxError，「标识符< 标识符」比较链等运行期错误必为 TypeError/ReferenceError，
  // web-erp: 以错误类型加门，避免把比较链（如 this.a.min < this.b.max）误诊成 JSX
  const jsx = error instanceof SyntaxError && looksLikeJSX(expression)
  const context = {
    expression,
    jsx,
    scopeKeys: Object.keys(scope || {}),
    message: jsx ? '不支持 JSX 表达式（web-erp 方言 v1 拒绝）' : error?.message || String(error)
  }

  if (isFunction(configure.onError)) {
    try {
      configure.onError(error, context)
    } catch (hookError) {
      // web-erp: 宿主 onError 钩子自炸时兜底上报，不让钩子异常贯穿渲染
      console.error('[tiny-schema-renderer] onError 钩子执行失败:', hookError?.message || hookError)
    }
  } else {
    console.error('[tiny-schema-renderer] 解析失败:', context.message, context)
  }
}

// web-erp: 方法运行期警告统一出口（原 Notify 改造），onWarn 未配置时 console.warn 兜底
const reportWarn = (title, message) => {
  if (isFunction(configure.onWarn)) {
    try {
      configure.onWarn(new Error(message), { title, message })
    } catch (hookError) {
      // web-erp: 宿主 onWarn 钩子自炸时兜底上报，不让钩子异常贯穿渲染
      console.error('[tiny-schema-renderer] onWarn 钩子执行失败:', hookError?.message || hookError)
    }
  } else {
    console.warn(`[tiny-schema-renderer] ${title}: ${message}`)
  }
}

const isJSSlot = (data) => {
  return data && data.type === 'JSSlot'
}

const isJSExpression = (data) => {
  return data && data.type === 'JSExpression'
}

const isJSFunction = (data) => {
  return data && data.type === 'JSFunction'
}

const isJSResource = (data) => {
  return data && data.type === 'JSResource'
}

const isString = (data) => {
  return typeof data === 'string'
}

const isArray = (data) => {
  return Array.isArray(data)
}

const isFunction = (data) => {
  return typeof data === 'function'
}

const isObject = (data) => {
  return typeof data === 'object'
}

// 判断是否是状态访问器
export const isStateAccessor = (stateData) =>
  stateData?.accessor?.getter?.type === 'JSFunction' || stateData?.accessor?.setter?.type === 'JSFunction'

// 规避创建function eslint报错
export const newFn = (...argv) => {
  const Fn = Function
  return new Fn(...argv)
}

const parseExpression = (data, scope, ctx) => {
  try {
    return newFn('$scope', `with($scope || {}) { return ${data.value} }`).call(ctx, {
      ...ctx,
      ...scope,
      slotScope: scope
    })
  } catch (error) {
    // web-erp: 删除 JSX/babel 降级重试 —— 求值单次执行，失败走 onError 上报（无静默失败）后返回 undefined
    reportParseError(error, data?.value, scope)
    return undefined
  }
}

function renderComponent(schema, scope, parent) {
  const { componentName, loop, loopArgs, condition } = schema

  // 处理数据源和表格fetchData的映射关系
  generateCollection(schema)

  if (!componentName) {
    return parseData(schema, scope, parent)
  }

  const component = getComponent(componentName)

  // web-erp: loop/condition/props/children 解析补回 parent（pageContext）实参 —— 此前丢失导致渲染期
  // JSExpression 拿不到 ctx、this.state/methods 全部失效（上游 main 为三参形态，对齐恢复）
  const loopList = parseData(loop, scope, parent)

  const renderElement = (item, index) => {
    let mergeScope = item
      ? getLoopScope({
          item,
          index,
          loopArgs,
          scope
        })
      : scope

    if (!parseCondition(condition, mergeScope, parent)) {
      return null
    }

    const Ele = h(component, getBindProps(schema, mergeScope, parent), getChildren(schema, mergeScope, parent))

    return Ele
  }

  return loopList?.length ? loopList.map(renderElement) : renderElement()
}

const renderDefault = (children, scope, parent) => children.map?.((child) => renderComponent(child, scope, parent))

const parseJSSlot = (data, scope) => {
  return ($scope) => renderDefault(data.value, { ...scope, ...$scope }, data)
}

export const generateFn = (innerFn, context) => {
  return (...args) => {
    // 如果有数据源标识，则表格的fetchData返回数据源的静态数据
    const sourceId = collectionMethodsMap[innerFn.realName || innerFn.name]
    if (sourceId) {
      return innerFn.call(context, ...args)
    } else {
      let result = null

      // 这里是为了兼容用户写法报错导致画布异常，但无法捕获promise内部的异常
      try {
        result = innerFn.call(context, ...args)
      } catch (error) {
        // web-erp: 原 Notify 改走 configure.onWarn（拔掉 @opentiny/vue 静态依赖）
        reportWarn(`函数:${innerFn.name}执行报错`, error?.message || `函数:${innerFn.name}执行报错，请检查语法`)
      }

      // 这里注意如果innerFn返回的是一个promise则需要捕获异常，重新返回默认一条空数据
      if (result?.then) {
        result = new Promise((resolve) => {
          result.then(resolve).catch((error) => {
            // web-erp: 原 Notify 改走 configure.onWarn（拔掉 @opentiny/vue 静态依赖）
            reportWarn('异步函数执行报错', error?.message || '异步函数执行报错，请检查语法')
            // web-erp: 画布习惯保留 —— 至少返回一条空数据，方便用户使用表格默认插槽
            resolve({
              result: [{}],
              page: { total: 1 }
            })
          })
        })
      }

      return result
    }
  }
}

// web-erp: 删除 parseFunctionString 与 parseJSXFunction —— 仅服务于已移除的 babel JSX 降级链路，
// JSFunction 值由 newFn 直接构造，失败统一走 reportParseError 上报（见 parseJSFunction）

// web-erp: 删除 getPlainProps（连同 hyphenate/hyphenateRE）—— fork 与上游均无调用点的死代码，
// props 键名契约由真实路径 parseObjectData 钉住（键名原样透传不转换，见 __tests__/plainProps.spec.js）

const generateCollection = (schema) => {
  if (schema.componentName === 'Collection' && schema.props?.dataSource && schema.children) {
    schema.children.forEach((item) => {
      const fetchData = item.props?.fetchData
      const methodMatch = fetchData?.value?.match(/this\.(.+?)}/)
      if (fetchData && methodMatch?.[1]) {
        const methodName = methodMatch[1].trim()
        // 缓存表格fetchData对应的数据源信息
        collectionMethodsMap[methodName] = schema.props.dataSource
      }
    })
  }
}

export const getComponent = (name) => {
  // web-erp: 解析顺序 —— registerMaterials 注册物料 > 内置 Mapper > configure.tinyVue native 兜底 > 自定义元素 > 原生 HTML 标签
  return materials[name] || Mapper[name] || getNative(name) || customElements[name] || (isHTMLTag(name) ? name : null)
}

const parseJSFunction = (data, scope, ctx) => {
  try {
    const innerFn = newFn(`return ${data.value}`).bind(ctx)()
    return generateFn(innerFn, ctx)
  } catch (error) {
    // web-erp: 删除 JSX 函数降级（parseJSXFunction/babel）—— 含 JSX 的函数声明直接报「不支持 JSX」并返回 undefined（方言 v1 拒绝）
    reportParseError(error, data?.value, scope)
    return undefined
  }
}

const parseList = []

export function parseData(data, scope, ctx) {
  let res = data
  parseList.some((item) => {
    if (item.type(data)) {
      res = item.parseFunc(data, scope, ctx)

      return true
    }

    return false
  })

  return res
}

const parseCondition = (condition, scope, ctx) => {
  // eslint-disable-next-line no-eq-null
  return condition == null ? true : parseData(condition, scope, ctx)
}

const parseLoopArgs = (_loop) => {
  if (_loop) {
    const { item, index, loopArgs = '' } = _loop
    const body = `return {${loopArgs[0] || 'item'}: item, ${loopArgs[1] || 'index'} : index }`
    return newFn('item,index', body)(item, index)
  }
  return undefined
}

export const getIcon = (name) => window.TinyVueIcon?.[name]?.() || ''

const parseObjectData = (data, scope, ctx) => {
  if (!data) {
    return data
  }

  // 如果是状态访问器,则直接解析默认值
  if (isStateAccessor(data)) {
    return parseData(data.defaultValue)
  }

  // 解析通过属性传递icon图标组件
  if (data.componentName === 'Icon') {
    return getIcon(data.props.name)
  }
  const res = {}
  Object.entries(data).forEach(([key, value]) => {
    // 如果是插槽则需要进行特殊处理
    if (key === 'slot' && value?.name) {
      res[key] = value.name
    } else {
      res[key] = parseData(value, scope, ctx)
    }
  })

  const propsEntries = Object.entries(data)
  const modelValue = propsEntries.find(([_key, value]) => value?.type === JS_EXPRESSION && value?.model === true)
  const hasUpdateModelValue = propsEntries.find(([key]) => isOn(key) && key.startsWith(`onUpdate:${modelValue?.[0]}`))

  if (modelValue && !hasUpdateModelValue) {
    // 添加 onUpdate:modelKey 事件
    res[`onUpdate:${modelValue?.[0]}`] = parseData(
      {
        type: JS_FUNCTION,
        value: `(value) => ${modelValue[1].value}=value`
      },
      scope,
      ctx
    )
  }

  return res
}

const parseString = (data) => {
  return data.trim()
}

const parseArray = (data, scope, ctx) => {
  return data.map((item) => parseData(item, scope, ctx))
}

const parseFunction = (data, scope, ctx) => {
  return data.bind(ctx)
}

parseList.push(
  ...[
    {
      type: isJSExpression,
      parseFunc: parseExpression
    },
    {
      type: isJSFunction,
      parseFunc: parseJSFunction
    },
    {
      type: isJSResource,
      parseFunc: parseExpression
    },
    {
      type: isJSSlot,
      parseFunc: parseJSSlot
    },
    {
      type: isString,
      parseFunc: parseString
    },
    {
      type: isArray,
      parseFunc: parseArray
    },
    {
      type: isFunction,
      parseFunc: parseFunction
    },
    {
      type: isObject,
      parseFunc: parseObjectData
    }
  ]
)

const generateSlotGroup = (children, isCustomElm, schema) => {
  const slotGroup = {}

  children.forEach((child) => {
    const { componentName, children, params = [], props } = child
    const slot = child.slot || props?.slot?.name || props?.slot || 'default'
    const isNotEmptyTemplate = componentName === 'Template' && children.length

    isCustomElm && (child.props.slot = 'slot') // CE下需要给子节点加上slot标识
    slotGroup[slot] = slotGroup[slot] || {
      value: [],
      params,
      parent: isNotEmptyTemplate ? child : schema
    }

    slotGroup[slot].value.push(...(isNotEmptyTemplate ? children : [child])) // template 标签直接过滤掉
  })

  return slotGroup
}

const renderSlot = (children, scope, schema, isCustomElm) => {
  if (children.some((a) => a.componentName === 'Template')) {
    const slotGroup = generateSlotGroup(children, isCustomElm, schema)
    const slots = {}

    Object.keys(slotGroup).forEach((slotName) => {
      const currentSlot = slotGroup[slotName]

      slots[slotName] = ($scope) => renderDefault(currentSlot.value, { ...scope, ...$scope }, currentSlot.parent)
    })

    return slots
  }

  return { default: () => renderDefault(children, scope, schema) }
}

const checkGroup = (componentName) => configure[componentName]?.nestingRule?.childWhitelist?.length

const directChildrenHasTemplate = (children) => children.some((child) => child.componentName === 'Template')

const getBindProps = (schema, scope, context) => {
  const { componentName } = schema

  if (componentName === 'CanvasPlaceholder') {
    return {}
  }

  const bindProps = {
    ...parseData(schema.props, scope, context)
  }

  if (Mapper[componentName]) {
    bindProps.schema = schema
  }

  // 绑定组件属性时需要将 className 重命名为 class，防止覆盖组件内置 class
  bindProps.class = bindProps.className
  delete bindProps.className

  return bindProps
}

const getLoopScope = ({ scope, index, item, loopArgs }) => {
  return {
    ...scope,
    ...(parseLoopArgs({
      item,
      index,
      loopArgs
    }) || {})
  }
}

const injectPlaceHolder = (componentName, children) => {
  const isEmptyArr = Array.isArray(children) && !children.length

  if (configure[componentName]?.isContainer && (!children || isEmptyArr)) {
    return [
      {
        componentName: 'CanvasPlaceholder'
      }
    ]
  }

  return children
}

const renderGroup = (children, scope, context) => {
  return children.map?.((schema) => {
    const { componentName, children, loop, loopArgs, condition, id } = schema
    const loopList = parseData(loop, scope, context)

    const renderElement = (item, index) => {
      const mergeScope = getLoopScope({
        scope,
        index,
        item,
        loopArgs
      })

      if (!parseCondition(condition, mergeScope, context)) {
        return null
      }

      const renderChildren = injectPlaceHolder(componentName, children)

      return h(
        getComponent(componentName),
        getBindProps(schema, mergeScope, context),
        Array.isArray(renderChildren)
          ? renderSlot(renderChildren, mergeScope, schema)
          : parseData(renderChildren, mergeScope, context)
      )
    }

    return loopList?.length ? loopList.map(renderElement) : renderElement()
  })
}

const getChildren = (schema, mergeScope, context) => {
  const { componentName, children } = schema
  const renderChildren = injectPlaceHolder(componentName, children)

  if (!Array.isArray(renderChildren)) {
    return parseData(renderChildren, mergeScope, context)
  }

  if (!renderChildren.length) {
    return null
  }

  const isCustomElm = customElements[componentName]

  if (directChildrenHasTemplate(renderChildren)) {
    return renderSlot(renderChildren, mergeScope, schema, isCustomElm)
  }

  return renderGroup(renderChildren, mergeScope, context)
}

export const renderer = {
  name: 'renderer',
  props: {
    schema: Object,
    scope: Object,
    parent: Object
  },
  setup(props) {
    provide('schema', props.schema)
  },
  render() {
    const context = inject('pageContext')
    const { scope, schema } = this

    return renderComponent(schema, scope, context)
  }
}

export default renderer
