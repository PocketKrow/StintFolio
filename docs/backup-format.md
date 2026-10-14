# Backup format v1

The plaintext document has `format: "StintFolio"`, `formatVersion: 1`, `schemaVersion: 1`, `exportedAt` (UTC epoch ms), one `workspace`, arrays of `clients`, `projects`, `timeEntries` and `drafts`, nullable `activeTimer`, one `settings` record, and `metadata`. Field schemas are defined in `src/database/schema.ts` and `src/services/backup.ts`.

Validation rejects unknown fields, unsupported versions, invalid record values, duplicate collection IDs, missing project/client relationships, inconsistent timer states, and drafts targeting missing records. Limits: 20,000 clients/projects each, 50,000 entries, 1,000 drafts, and a 10 MiB file. Time-entry duration must be positive and fit within its timestamp span.

An encrypted file is a JSON envelope with these fields:

| Field         | Value                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| format        | `StintFolioEncrypted`                                                   |
| formatVersion | `1`                                                                     |
| cipher        | `AES-GCM`                                                               |
| kdf           | `PBKDF2-SHA256`                                                         |
| iterations    | `600000`                                                                |
| salt          | 16 cryptographically random bytes, standard base64                      |
| nonce         | 12 cryptographically random bytes, standard base64                      |
| ciphertext    | AES-256-GCM ciphertext plus 128-bit authentication tag, standard base64 |

The UTF-8 passphrase is imported as PBKDF2 key material, using SHA-256 to derive a non-extractable 256-bit AES key. GCM additional authenticated data is the UTF-8 string `StintFolioEncrypted:1:AES-GCM:PBKDF2-SHA256:600000`. Parameters are exact/versioned, preventing attacker-provided iteration counts from creating unbounded derivation work. Salt/nonce lengths are checked before decryption. Export requires at least 12 passphrase characters. Passphrases are not normalized or retained, so preserve the exact string.

Decoded plaintext passes the same record and relationship validation as a JSON import. Import previews counts, requires typing `RESTORE`, and replaces all stores transactionally. A decryption or validation failure changes nothing. An interrupted replacement rolls back to the original records. The singleton timer revision is regenerated, but timestamps and accumulated time are preserved; running imports may need duration review.

Encryption protects the backup file, not the live IndexedDB database. An unencrypted export contains readable business information. The download API cannot verify that a user retained the file; metadata records only a requested download. A misplaced passphrase cannot be recovered by StintFolio.
