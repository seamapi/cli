{
  lib,
  stdenv,
  bun,
  buildNpmPackage,
  importNpmLock,
  installShellFiles,
}:

buildNpmPackage {
  pname = "seam";
  version = (lib.importJSON ./package.json).version;

  src = lib.cleanSource ./.;

  npmDeps = importNpmLock { npmRoot = ./.; };
  npmConfigHook = importNpmLock.npmConfigHook;

  nativeBuildInputs = [
    bun
    installShellFiles
  ];
  npmBuildScript = "build:standalone";

  installPhase = ''
    runHook preInstall

    install -Dm755 seam -t $out/bin

    runHook postInstall
  '';

  postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
    installShellCompletion --cmd seam \
      --bash <($out/bin/seam completion --loader bash) \
      --fish <($out/bin/seam completion --loader fish) \
      --zsh <($out/bin/seam completion --loader zsh)
  '';

  # The executable is the Bun runtime with the JavaScript bundle appended, so
  # rewriting the ELF loses the bundle: stripped it runs as plain Bun,
  # patchelfed it segfaults.
  dontStrip = true;
  dontPatchELF = true;

  meta = {
    description = "Command-line interface (CLI) for interacting with the Seam API";
    homepage = "https://github.com/seamapi/cli";
    changelog = "https://github.com/seamapi/cli/releases";
    license = lib.licenses.mit;
    mainProgram = "seam";
    platforms = bun.meta.platforms;
  };
}
