Feature: DevClock options page preferences
  As an engineer configuring DevClock
  I want to update settings from the options page
  So that popup conversions and query output follow my preferences

  Background:
    Given I open the options page

  Scenario: Timezone dropdown options include offset labels
    When I open the local timezone dropdown
    Then the timezone option "Europe/London" should include an offset label
    And the timezone option "America/New_York" should include an offset label

  Scenario: Provider dropdown uses custom combo options and saves selection
    When I open the provider dropdown
    Then the provider option "splunk" should be visible in the combo list
    And the provider option "grafana" should be visible in the combo list
    And the provider option "cloudwatch" should be visible in the combo list
    When I select provider option "cloudwatch"
    And I save options preferences
    Then options status should be "Preferences saved."
    And the saved query provider should be "cloudwatch"

  Scenario: Add source timezone and block duplicates
    When I type "Asia/Tokyo" in the add timezone field
    And I click add timezone
    Then source timezone chip "Asia/Tokyo" should be visible in options
    When I type "Asia/Tokyo" in the add timezone field
    And I click add timezone
    Then options status should contain "already in the list"

  Scenario: Reject invalid source timezone input
    When I type "Invalid/Timezone" in the add timezone field
    And I click add timezone
    Then options status should contain "Invalid timezone"
    And source timezone chip "Invalid/Timezone" should not be visible in options

  Scenario: Save and reload local timezone, provider, and hour format
    When I select local timezone option "Asia/Tokyo"
    And I select provider option "grafana"
    And I choose hour format "12h" in options
    And I save options preferences
    Then options status should be "Preferences saved."
    And the saved local timezone should be "Asia/Tokyo"
    And the saved query provider should be "grafana"
    And the saved hour format should be "12h"
    When I reload the options page
    Then the local timezone input should be "Asia/Tokyo"
    And the provider input should be "Grafana"
    And the options hour format should be "12h"
