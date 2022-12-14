import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {Config, CreateConfig} from './config'

export async function run(): Promise<void> {
  try {
    const config: Config = CreateConfig()

    core.startGroup('Setup wrangler')
    let installVersion = 'wrangler'

    if (config.wranglerVersion.startsWith('1')) {
      installVersion = `@cloudflare/wrangler@${config.wranglerVersion}`
    } else if (config.wranglerVersion !== '') {
      installVersion = `wrangler@${config.wranglerVersion}`
    }

    await exec.exec(`npm install --location=global "${installVersion}"`)
    core.endGroup()

    core.startGroup('Publishing')
    var command_line_args: string[] = []

    if (config.environment !== '') {
      command_line_args.push('--env', config.environment)
    }

    if (config.config_file !== '') {
      command_line_args.push('--config', config.config_file)
    }

    let publish_output = 1
    if (config.command === '') {
      core.notice("No command was provided, defaulting to 'publish'")
      publish_output = await exec.exec(
        'wrangler',
        ['publish', ...command_line_args],
        {
          ignoreReturnCode: true,
          cwd: config.workdir
        }
      )
    } else {
      if (config.environment !== '') {
        core.warning(
          "You have specified an environment you need to make sure to pass in '--env $INPUT_ENVIRONMENT' to your command."
        )
      }
      publish_output = await exec.exec('wrangler', [config.command], {
        cwd: config.workdir
      })
    }

    if (publish_output !== 0) {
      core.setFailed(`Publish command did not complete successfully`)
    }

    core.endGroup()

    if (config.secrets.length !== 0) {
      core.startGroup('Setting Secrets')
      for (const secret of config.secrets) {
        if (process.env[secret] === undefined && config.failMissingSecret) {
          throw new Error(`Secret '${secret}' wanted and not set`)
        }
        const secret_output = await exec.getExecOutput(
          `echo "${process.env[secret]}" | wrangler`,
          ['secret', 'put', `${secret}`, ...command_line_args],
          {
            ignoreReturnCode: true
          }
        )
        core.info((secret_output.stdout, secret_output.stderr))
        if (secret_output.exitCode !== 0) {
          throw new Error(
            `Error setting secret '${secret}': ${secret_output.stdout}, ${secret_output.stderr}`
          )
        }
      }
      core.endGroup()
    }
  } catch (error) {
    core.setFailed(`Error occurred during run: ${error}`)
  }
}

run()
