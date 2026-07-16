import { normalizeCampaignDirectoryPath } from "../../src/campaign/campaign-loader.js"

describe("normalizeCampaignDirectoryPath", () => {
  it("converts a leading MSYS drive path on Windows", () => {
    expect(normalizeCampaignDirectoryPath("/c/Users/ada/candidates", "win32")).toBe("C:/Users/ada/candidates")
  })

  it("leaves non-MSYS and non-Windows paths unchanged", () => {
    expect(normalizeCampaignDirectoryPath("C:/Users/ada/candidates", "win32")).toBe("C:/Users/ada/candidates")
    expect(normalizeCampaignDirectoryPath("/home/ada/candidates", "win32")).toBe("/home/ada/candidates")
    expect(normalizeCampaignDirectoryPath("/c/Users/ada/candidates", "linux")).toBe("/c/Users/ada/candidates")
  })
})
