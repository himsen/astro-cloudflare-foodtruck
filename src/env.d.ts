/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts after the Access JWT is verified. */
    accessEmail?: string;
  }
}
