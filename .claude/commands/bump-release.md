Increment the version, commit the version bump, generate a new github tag & release which has the changelog (can be a single command using --target when doing gh release create)

In case of large changelogs, ask the user if the bump is major, minor, or patch.

Delete the `dist folder` and run build script (single command with &&), then publish the new version to NPM
