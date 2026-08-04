import type { Parameter } from '@seamapi/blueprint'

import { interactForAccessCode } from './interact-for-access-code.js'
import { interactForAcsEntrance } from './interact-for-acs-entrance.js'
import { interactForAcsSystem } from './interact-for-acs-system.js'
import { interactForAcsUser } from './interact-for-acs-user.js'
import { interactForArray } from './interact-for-array.js'
import { interactForConnectedAccount } from './interact-for-connected-account.js'
import { interactForCustomMetadata } from './interact-for-custom-metadata.js'
import { interactForDevice } from './interact-for-device.js'
import { interactForTimestamp } from './interact-for-timestamp.js'
import { interactForUserIdentity } from './interact-for-user-identity.js'
import { getOutput } from './output/get-output.js'
import type { ContextHelpers } from './types.js'
import { NonInteractiveError, toArgName } from './util/cli-args.js'
import { ellipsis } from './util/ellipsis.js'
import { prompt } from './util/prompt.js'

const ergonomicPropOrder = [
  'name',
  'connected_account_id',
  'device_id',
  'access_code_id',
  'user_identity_id',
  'code',
  'starts_at',
  'ends_at',
]

export const interactForBlueprintObject = async (
  args: {
    command: string[]
    parameters: Parameter[]
    params: Record<string, any>
    isSubProperty?: boolean
    subPropertyPath?: string
  },
  ctx: ContextHelpers,
): Promise<any> => {
  // Clone args and args params so that we can mutate it
  args = { ...args, params: { ...args.params } }

  const properties = Object.fromEntries(
    args.parameters.map((parameter) => [parameter.name, parameter]),
  )
  const required = args.parameters
    .filter((parameter) => parameter.isRequired)
    .map((parameter) => parameter.name)

  const haveAllRequiredParams = required.every((k) => args.params[k])

  const cmdPath = `/${args.command.join('/').replace(/-/g, '_')}`

  const shouldAutoSubmit =
    ctx.interactivity !== 'interactive' &&
    haveAllRequiredParams &&
    !args.isSubProperty
  if (shouldAutoSubmit) {
    return args.params
  }

  if (ctx.interactivity === 'non-interactive') {
    const missing = required.filter((k) => !args.params[k])
    const target = args.isSubProperty ? `"${args.subPropertyPath}"` : cmdPath
    throw new NonInteractiveError(
      missing.length > 0
        ? `Missing required ${
            missing.length === 1 ? 'parameter' : 'parameters'
          } for ${target}: ${missing.map(toArgName).join(' ')}`
        : `Cannot prompt for ${target} in non-interactive mode`,
    )
  }

  const propSortScore = (prop: string) => {
    if (required.includes(prop)) return 100 - ergonomicPropOrder.indexOf(prop)
    if (args.params[prop] !== undefined) {
      return 50 - Object.keys(args.params).indexOf(prop)
    }
    return ergonomicPropOrder.indexOf(prop)
  }

  const parameterSelectionMessage = args.isSubProperty
    ? `Editing "${args.subPropertyPath}"`
    : `[${cmdPath}] Parameters`

  getOutput().info()
  const { paramToEdit } = await prompt({
    name: 'paramToEdit',
    message: parameterSelectionMessage,
    type: 'autocomplete',
    choices: [
      ...(haveAllRequiredParams && !args.isSubProperty
        ? [
            {
              value: 'done',
              title: `[Make API Call] ${cmdPath}`,
            },
          ]
        : []),
      ...(haveAllRequiredParams && args.isSubProperty
        ? [
            {
              title: `[Save]`,
              value: 'done',
            },
          ]
        : []),
      ...Object.keys(properties)
        .map((k) => {
          return {
            title: k + (required.includes(k) ? '*' : ''),
            value: k,
            description:
              args.params[k] !== undefined
                ? typeof args.params[k] === 'object'
                  ? ellipsis(JSON.stringify(args.params[k]), 60)
                  : `[${args.params[k]}]`
                : undefined,
          }
        })
        .sort((a, b) => propSortScore(b.value) - propSortScore(a.value)),
      ...(args.isSubProperty
        ? [
            {
              title: `[Leave Empty]`,
              value: 'empty',
            },
          ]
        : []),
      {
        title: `[Back]`,
        value: 'back',
      },
    ],
  })

  if (paramToEdit === 'empty') {
    return undefined
  }

  if (paramToEdit === 'done') {
    // TODO check for required
    return args.params
  }

  if (paramToEdit === 'back') {
    if (args.subPropertyPath) {
      return args.params
    }

    return '[Back]'
  }

  const prop = properties[paramToEdit]

  if (paramToEdit === 'device_id') {
    args.params[paramToEdit] = await interactForDevice()
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit === 'access_code_id') {
    args.params[paramToEdit] = await interactForAccessCode(args.params as any)
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit === 'connected_account_id') {
    const connectedAccountId = await interactForConnectedAccount()
    args.params[paramToEdit] = connectedAccountId
    return interactForBlueprintObject(args, ctx)
  } else if (
    paramToEdit === 'user_identity_id' ||
    paramToEdit === 'user_identity_ids'
  ) {
    const userIdentityId = await interactForUserIdentity()
    args.params[paramToEdit] =
      paramToEdit === 'user_identity_ids' ? [userIdentityId] : userIdentityId
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit.endsWith('acs_system_id')) {
    args.params[paramToEdit] = await interactForAcsSystem()
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit.endsWith('acs_user_id')) {
    args.params[paramToEdit] = await interactForAcsUser()
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit.endsWith('acs_entrance_id')) {
    args.params['acs_entrance_id'] = await interactForAcsEntrance()
    return interactForBlueprintObject(args, ctx)
  } else if (
    paramToEdit.endsWith('_at') ||
    paramToEdit === 'since' ||
    paramToEdit.endsWith('_before') ||
    paramToEdit.endsWith('_after')
  ) {
    args.params[paramToEdit] = await interactForTimestamp()
    return interactForBlueprintObject(args, ctx)
  } else if (paramToEdit === 'custom_metadata') {
    args.params[paramToEdit] = await interactForCustomMetadata(
      args.params[paramToEdit] || {},
    )
    return interactForBlueprintObject(args, ctx)
  }

  if (prop) {
    if (['string', 'id', 'datetime'].includes(prop.format)) {
      let value
      if (prop.format === 'datetime') {
        value = await interactForTimestamp()
      } else {
        value = (
          await prompt({
            name: 'value',
            message: `${paramToEdit}:`,
            type: 'text',
          })
        ).value
      }
      args.params[paramToEdit] = value
      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'enum') {
      const value = (
        await prompt({
          name: 'value',
          message: `${paramToEdit}:`,
          type: 'select',
          choices: prop.values.map((v) => ({
            title: v.name,
            value: v.name,
          })),
        })
      ).value
      args.params[paramToEdit] = value
      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'boolean') {
      const { value } = await prompt({
        name: 'value',
        message: `${paramToEdit}:`,
        type: 'toggle',
        initial: true,
        active: 'true',
        inactive: 'false',
      })

      args.params[paramToEdit] = value

      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'list' && prop.itemFormat === 'enum') {
      const value = (
        await prompt({
          name: 'value',
          message: `${paramToEdit}:`,
          type: 'autocompleteMultiselect',
          choices: prop.itemEnumValues.map((v) => ({
            title: v.name,
            value: v.name,
          })),
        })
      ).value
      args.params[paramToEdit] = value
      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'list') {
      args.params[paramToEdit] = await interactForArray(
        args.params[paramToEdit] || [],
        `Edit the list for ${paramToEdit}`,
      )
      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'object') {
      args.params[paramToEdit] = await interactForBlueprintObject(
        {
          command: args.command,
          params: {},
          parameters: prop.parameters,
          isSubProperty: true,
          subPropertyPath: paramToEdit,
        },
        ctx,
      )
      return interactForBlueprintObject(args, ctx)
    } else if (prop.format === 'number') {
      const { value } = await prompt({
        name: 'value',
        message: `${paramToEdit}:`,
        type: 'number',
      })

      args.params[paramToEdit] = value

      return interactForBlueprintObject(args, ctx)
    }
  }

  throw new Error(
    `Didn't know how to handle Blueprint parameter for property: "${paramToEdit}"`,
  )
}
