/**
 * 验证工具模块
 *
 * 该模块提供各种数据验证功能，包括参数验证、类型检查、
 * 格式验证等，确保数据的有效性和一致性。
 *
 * @author MCP Terminal Server Team
 * @version 1.1.0
 */

// ============================================================================
// 基础验证函数
// ============================================================================

/**
 * 检查值是否为空或未定义
 * @param {*} value - 要检查的值
 * @returns {boolean} 是否为空或未定义
 */
export function isEmpty(value) {
    return value === null || value === undefined || value === '';
}

/**
 * 检查值是否为非空字符串
 * @param {*} value - 要检查的值
 * @returns {boolean} 是否为非空字符串
 */
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 检查值是否为有效数字
 * @param {*} value - 要检查的值
 * @returns {boolean} 是否为有效数字
 */
export function isValidNumber(value) {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * 检查值是否为正整数
 * @param {*} value - 要检查的值
 * @returns {boolean} 是否为正整数
 */
export function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

/**
 * 检查值是否为有效的UUID
 * @param {*} value - 要检查的值
 * @returns {boolean} 是否为有效的UUID
 */
export function isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof value === 'string' && uuidRegex.test(value);
}

// ============================================================================
// 参数验证类
// ============================================================================

/**
 * 参数验证器类
 *
 * 提供统一的参数验证接口，支持必需参数检查、
 * 类型验证和自定义验证规则。
 */
export class ParameterValidator {
    /**
     * 构造函数
     */
    constructor() {
        this.errors = [];
    }

    /**
     * 重置验证错误
     */
    reset() {
        this.errors = [];
    }

    /**
     * 添加验证错误
     * @param {string} message - 错误消息
     * @private
     */
    _addError(message) {
        this.errors.push(message);
    }

    /**
     * 验证必需参数是否存在
     * @param {Object} args - 参数对象
     * @param {string[]} requiredParams - 必需参数名称数组
     * @returns {ParameterValidator} 返回自身以支持链式调用
     */
    validateRequired(args, requiredParams) {
        if (!args || typeof args !== 'object') {
            this._addError('参数对象不能为空');
            return this;
        }

        const missingParams = requiredParams.filter(param => isEmpty(args[param]));
        if (missingParams.length > 0) {
            this._addError(`缺少必需参数: ${missingParams.join(', ')}`);
        }

        return this;
    }

    /**
     * 验证字符串参数
     * @param {Object} args - 参数对象
     * @param {string} paramName - 参数名称
     * @param {boolean} required - 是否必需
     * @returns {ParameterValidator} 返回自身以支持链式调用
     */
    validateString(args, paramName, required = true) {
        const value = args[paramName];

        if (required && isEmpty(value)) {
            this._addError(`参数 ${paramName} 不能为空`);
        } else if (!isEmpty(value) && !isNonEmptyString(value)) {
            this._addError(`参数 ${paramName} 必须是非空字符串`);
        }

        return this;
    }

    /**
     * 验证数字参数
     * @param {Object} args - 参数对象
     * @param {string} paramName - 参数名称
     * @param {boolean} required - 是否必需
     * @param {number} min - 最小值（可选）
     * @param {number} max - 最大值（可选）
     * @returns {ParameterValidator} 返回自身以支持链式调用
     */
    validateNumber(args, paramName, required = true, min = null, max = null) {
        const value = args[paramName];

        if (required && isEmpty(value)) {
            this._addError(`参数 ${paramName} 不能为空`);
        } else if (!isEmpty(value)) {
            if (!isValidNumber(value)) {
                this._addError(`参数 ${paramName} 必须是有效数字`);
            } else {
                if (min !== null && value < min) {
                    this._addError(`参数 ${paramName} 不能小于 ${min}`);
                }
                if (max !== null && value > max) {
                    this._addError(`参数 ${paramName} 不能大于 ${max}`);
                }
            }
        }

        return this;
    }

    /**
     * 验证布尔参数
     * @param {Object} args - 参数对象
     * @param {string} paramName - 参数名称
     * @param {boolean} required - 是否必需
     * @returns {ParameterValidator} 返回自身以支持链式调用
     */
    validateBoolean(args, paramName, required = true) {
        const value = args[paramName];

        if (required && isEmpty(value)) {
            this._addError(`参数 ${paramName} 不能为空`);
        } else if (!isEmpty(value) && typeof value !== 'boolean') {
            this._addError(`参数 ${paramName} 必须是布尔值`);
        }

        return this;
    }

    /**
     * 验证枚举参数
     * @param {Object} args - 参数对象
     * @param {string} paramName - 参数名称
     * @param {Array} allowedValues - 允许的值数组
     * @param {boolean} required - 是否必需
     * @returns {ParameterValidator} 返回自身以支持链式调用
     */
    validateEnum(args, paramName, allowedValues, required = true) {
        const value = args[paramName];

        if (required && isEmpty(value)) {
            this._addError(`参数 ${paramName} 不能为空`);
        } else if (!isEmpty(value) && !allowedValues.includes(value)) {
            this._addError(`参数 ${paramName} 必须是以下值之一: ${allowedValues.join(', ')}`);
        }

        return this;
    }

    /**
     * 检查是否有验证错误
     * @returns {boolean} 是否有错误
     */
    hasErrors() {
        return this.errors.length > 0;
    }

    /**
     * 获取所有验证错误
     * @returns {string[]} 错误消息数组
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * 获取第一个验证错误
     * @returns {string|null} 第一个错误消息或null
     */
    getFirstError() {
        return this.errors.length > 0 ? this.errors[0] : null;
    }

    /**
     * 抛出验证错误（如果有）
     * @throws {Error} 包含所有验证错误的Error对象
     */
    throwIfErrors() {
        if (this.hasErrors()) {
            throw new Error(this.errors.join('; '));
        }
    }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建参数验证器实例
 * @returns {ParameterValidator} 新的参数验证器实例
 */
export function createValidator() {
    return new ParameterValidator();
}

/**
 * 验证必需参数的便捷函数
 * @param {Object} args - 参数对象
 * @param {string[]} requiredParams - 必需参数名称数组
 * @throws {Error} 当缺少必需参数时抛出错误
 */
export function validateRequiredParams(args, requiredParams) {
    const validator = new ParameterValidator();
    validator.validateRequired(args, requiredParams).throwIfErrors();
}
