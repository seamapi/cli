import type { Parameter } from '@seamapi/blueprint'

import { assertRequiredParams } from 'lib/args/validate.js'
import type { CliContext } from 'lib/context.js'
import { NonInteractiveError, PromptCancelledError } from 'lib/errors.js'
import { getOutput } from 'lib/output/get-output.js'
import {
  promptAutocomplete,
  promptAutocompleteMultiselect,
  promptConfirm,
  promptNumber,
  promptSelect,
  promptText,
  withBackHint,
} from 'lib/prompt.js'
import { ellipsis } from 'lib/render/text.js'

import { interactForAccessCode } from './access-code.js'
import { interactForAcsEntrance } from './acs-entrance.js'
import { interactForAcsSystem } from './acs-system.js'
import { interactForAcsUser } from './acs-user.js'
import { interactForArray } from './array.js'
import { interactForConnectedAccount } from './connected-account.js'
import { interactForCustomMetadata } from './custom-metadata.js'
import { interactForDevice } from './device.js'
import { interactForTimestamp } from './timestamp.js'
import { interactForUserIdentity } from './user-identity.js'

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
    hasRequiredParameters?: boolean
    isSubProperty?: boolean
    subPropertyPath?: string
  },
  ctx: CliContext,
): Promise<any> => {
  // Clone args and args params so that we can mutate it
  args = { ...args, params: { ...args.params } }

  const properties = Object.fromEntries(
    args.parameters.map((parameter) => [parameter.name, parameter]),
  )
  const required = args.parameters
    .filter((parameter) => parameter.isRequired)
    .map((parameter) => parameter.name)

  const isSupplied = (k: string): boolean => args.params[k] !== undefined

  const haveAllRequiredParams = required.every(isSupplied)
  // Some request schemas require one of several parameters without marking
  // any individual parameter as required. The request-level signal tells us
  // that an entirely empty request still needs interaction.
  const hasAnyParams = Object.values(args.params).some(
    (value) => value !== undefined,
  )
  const satisfiesRequestRequirement =
    args.hasRequiredParameters !== true || hasAnyParams

  const cmdPath = `/${args.command.join('/').replace(/-/g, '_')}`

  const shouldAutoSubmit =
    ctx.interactivity !== 'interactive' &&
    haveAllRequiredParams &&
    satisfiesRequestRequirement &&
    !args.isSubProperty
  if (shouldAutoSubmit) {
    return args.params
  }

  if (ctx.interactivity === 'non-interactive') {
    const target = args.isSubProperty ? `"${args.subPropertyPath}"` : cmdPath
    assertRequiredParams(args.parameters, args.params, target)
    throw new NonInteractiveError(
      `Cannot prompt for ${target} in non-interactive mode`,
    )
  }

  const propSortScore = (prop: string) => {
    if (required.includes(prop)) return 100 - ergonomicPropOrder.indexOf(prop)
    if (args.params[prop] !== undefined) {
      return 50 - Object.keys(args.params).indexOf(prop)
    }
    return ergonomicPropOrder.indexOf(prop)
  }

  const parameterSelectionMessage = withBackHint(
    args.isSubProperty
      ? `Editing "${args.subPropertyPath}"`
      : `[${cmdPath}] Parameters`,
  )

  getOutput().info()
  let paramToEdit: string
  try {
    paramToEdit = await promptAutocomplete({
      message: parameterSelectionMessage,
      choices: [
        ...(haveAllRequiredParams &&
        satisfiesRequestRequirement &&
        !args.isSubProperty
          ? [
              {
                value: 'done',
                label: `[Make API Call] ${cmdPath}`,
              },
            ]
          : []),
        ...(haveAllRequiredParams && args.isSubProperty
          ? [
              {
                label: `[Save]`,
                value: 'done',
              },
            ]
          : []),
        ...Object.keys(properties)
          .map((k) => {
            return {
              label: k + (required.includes(k) ? '*' : ''),
              value: k,
              hint:
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
                label: `[Leave Empty]`,
                value: 'empty',
              },
            ]
          : []),
        {
          label: `[Back]`,
          value: 'back',
        },
      ],
    })
  } catch (error) {
    // Dismissing the menu means the same as choosing to go back.
    if (!(error instanceof PromptCancelledError)) throw error
    paramToEdit = 'back'
  }

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

  // Dismissing any prompt below returns to the parameter menu with the
  // parameter left as it was, rather than ending the whole command.
  try {
    if (prop != null && (prop.isNullable || isSupplied(paramToEdit))) {
      const action = await promptSelect({
        message: withBackHint(`${paramToEdit}:`),
        choices: [
          { label: 'Enter a value', value: 'value' },
          ...(prop.isNullable
            ? [{ label: 'Set to null', value: 'null' as const }]
            : []),
          ...(isSupplied(paramToEdit)
            ? [{ label: 'Unset', value: 'unset' as const }]
            : []),
        ],
      })

      if (action === 'null') {
        args.params[paramToEdit] = null
        return interactForBlueprintObject(args, ctx)
      }
      if (action === 'unset') {
        delete args.params[paramToEdit]
        return interactForBlueprintObject(args, ctx)
      }
    }

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
    } else if (
      paramToEdit === 'custom_metadata' ||
      paramToEdit === 'custom_metadata_has'
    ) {
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
          value = await promptText({
            message: withBackHint(`${paramToEdit}:`),
          })
        }
        args.params[paramToEdit] = value
        return interactForBlueprintObject(args, ctx)
      } else if (prop.format === 'enum') {
        const value = await promptSelect({
          message: withBackHint(`${paramToEdit}:`),
          choices: prop.values.map((v) => ({
            label: v.name,
            value: v.name,
          })),
        })
        args.params[paramToEdit] = value
        return interactForBlueprintObject(args, ctx)
      } else if (prop.format === 'boolean') {
        const value = await promptConfirm({
          message: withBackHint(`${paramToEdit}:`),
          initialValue: true,
          active: 'true',
          inactive: 'false',
        })

        args.params[paramToEdit] = value

        return interactForBlueprintObject(args, ctx)
      } else if (prop.format === 'list' && prop.itemFormat === 'enum') {
        const value = await promptAutocompleteMultiselect({
          message: withBackHint(`${paramToEdit}:`),
          choices: prop.itemEnumValues.map((v) => ({
            label: v.name,
            value: v.name,
          })),
        })
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
            params: toObjectParams(args.params[paramToEdit]),
            parameters: prop.parameters,
            isSubProperty: true,
            subPropertyPath: paramToEdit,
          },
          ctx,
        )
        return interactForBlueprintObject(args, ctx)
      } else if (prop.format === 'number') {
        const value = await promptNumber({
          message: withBackHint(`${paramToEdit}:`),
        })

        args.params[paramToEdit] = value

        return interactForBlueprintObject(args, ctx)
      }
    }
  } catch (error) {
    if (!(error instanceof PromptCancelledError)) throw error
    return interactForBlueprintObject(args, ctx)
  }

  throw new Error(
    `Didn't know how to handle Blueprint parameter for property: "${paramToEdit}"`,
  )
}

/**
 * An object parameter's value as the params its editor starts from, so
 * editing is prefilled with what was given and leaving the editor keeps it.
 *
 * Params read from stdin are passed through as given, so the value is not
 * necessarily an object: anything else has nothing to edit and starts empty.
 */
const toObjectParams = (value: unknown): Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {}
